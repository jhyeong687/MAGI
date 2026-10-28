import express, { type ErrorRequestHandler } from 'express';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  ANSWER_REVISION,
  settingsSchema,
  summarize,
  type Environment,
  type Run,
} from '../shared/domain.ts';
import { detectEnvironment, cleanError } from './codex.ts';
import { Orchestrator } from './orchestrator.ts';
import { Store } from './store.ts';
import { LoginManager } from './login.ts';

export function createApp(
  store = new Store(),
  orchestrator = new Orchestrator(store),
  environment: (refresh?: boolean) => Promise<Environment> = detectEnvironment,
  login = new LoginManager(environment),
) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const host = req.headers.host || '';
    if (!/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) {
      res.status(403).json({ error: 'Local host required.' });
      return;
    }
    if (req.headers.origin && req.headers.origin !== `http://${host}`) {
      res.status(403).json({ error: 'Same-origin access required.' });
      return;
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json({ limit: '96kb' }));
  app.get('/api/environment', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await environment(req.query.refresh === '1'));
  });
  app.get('/api/settings', (_req, res) => res.json(store.settings));
  app.get('/api/auth', (_req, res) => res.json(login.snapshot()));
  app.post('/api/auth/login', async (_req, res) => {
    if (store.list().some((run) => run.status === 'running')) {
      res.status(409).json({ error: 'Wait for the current decision to finish.' });
      return;
    }
    res.status(202).json(await login.start());
  });
  app.post('/api/auth/cancel', (_req, res) => res.json(login.cancel()));
  app.put('/api/settings', (req, res) => {
    const settings = settingsSchema.parse(req.body);
    store.saveSettings(settings);
    orchestrator.emit('settings');
    res.json(settings);
  });
  app.get('/api/events', (req, res) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const send = (changed?: Run) => {
      const runs = store.list();
      const current = changed || runs.find((run) => run.status === 'running') || runs[0];
      res.write(
        `event: catalog\ndata: ${JSON.stringify({ runs: runs.map(summarize), settings: store.settings, current })}\n\n`,
      );
    };
    send();
    const settings = () => send();
    orchestrator.on('change', send);
    orchestrator.on('settings', settings);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      orchestrator.off('change', send);
      orchestrator.off('settings', settings);
    });
  });
  app.get('/api/runs', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(store.list().map(summarize));
  });
  const getRun = (id: string) =>
    /^[\da-f]{8}-[\da-f-]{27}$/i.test(id) ? store.runs.get(id) : undefined;
  app.post('/api/runs', async (req, res) => {
    const { question } = z.object({ question: z.string().trim().min(1).max(6000) }).parse(req.body);
    if (store.list().some((run) => run.status === 'running')) {
      res.status(409).json({ error: 'Another decision is running. Stop it first.' });
      return;
    }
    const env = await environment();
    if (!env.ready || !env.binary) {
      res.status(503).json({ error: env.issues.join('\n') || 'Codex is not ready.' });
      return;
    }
    try {
      res.status(201).json(orchestrator.create(question, store.settings, env.binary));
    } catch (error) {
      res.status(409).json({ error: cleanError(error) });
    }
  });
  app.get('/api/runs/:id', (req, res) => {
    const run = getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Decision not found.' });
      return;
    }
    res.json(run);
  });
  app.post('/api/runs/:id/cancel', (req, res) => {
    if (!getRun(req.params.id)) {
      res.status(404).json({ error: 'Decision not found.' });
      return;
    }
    res.json(orchestrator.cancel(req.params.id));
  });
  app.post('/api/runs/:id/answer', async (req, res) => {
    const { refresh } = z
      .object({ refresh: z.boolean().optional().default(false) })
      .strict()
      .parse(req.body || {});
    const run = getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Decision not found.' });
      return;
    }
    if (!run.verdict || run.status !== 'completed') {
      res.status(409).json({ error: 'A completed vote is required.' });
      return;
    }
    if (
      run.answer?.status === 'completed' &&
      (!refresh || run.answer.revision === ANSWER_REVISION)
    ) {
      res.json(run);
      return;
    }
    const env = await environment();
    if (!env.ready || !env.binary) {
      res.status(503).json({ error: env.issues.join('\n') || 'Codex is not ready.' });
      return;
    }
    try {
      res.status(202).json(orchestrator.generateAnswer(run.id, env.binary, refresh));
    } catch (error) {
      res.status(409).json({ error: cleanError(error) });
    }
  });
  app.get('/api/runs/:id/events', (req, res) => {
    const run = getRun(req.params.id);
    if (!run) {
      res.status(404).json({ error: 'Decision not found.' });
      return;
    }
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    const send = (value: typeof run) =>
      res.write(`id: ${value.version}\nevent: snapshot\ndata: ${JSON.stringify(value)}\n\n`);
    send(run);
    orchestrator.on(run.id, send);
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 15_000);
    req.on('close', () => {
      clearInterval(heartbeat);
      orchestrator.off(run.id, send);
    });
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    const validation = error instanceof z.ZodError;
    res
      .status(
        validation || error.type === 'entity.parse.failed'
          ? 400
          : error.type === 'entity.too.large'
            ? 413
            : 500,
      )
      .json({
        error: validation
          ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('\n')
          : cleanError(error),
      });
  };
  app.use(errors);
  return { app, store, orchestrator, login };
}

export async function attachFrontend(app: ReturnType<typeof express>) {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(resolve('dist')));
    app.get('/{*path}', (_req, res) => res.sendFile(resolve('dist/index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
    return vite;
  }
}
