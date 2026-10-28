// Dedicated browser-test server. No production data directory and no real model calls.
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Store } from '../server/store.ts';
import { Orchestrator } from '../server/orchestrator.ts';
import { createApp, attachFrontend } from '../server/app.ts';
import type { Environment, Persona, Vote } from '../shared/domain.ts';
import type { Runner } from '../server/codex.ts';
import { createScenario, fixtureAssessment, fixtureIds } from './fixtures/scenarios.ts';
import { fixtureSynthesis } from './fixtures/synthesis.ts';
import { createShowcase } from './fixtures/showcase.ts';

if (process.env.MAGI_BROWSER_TEST !== '1')
  throw new Error('This server is exclusively for isolated browser tests.');
const directory = mkdtempSync(join(tmpdir(), 'magi-isolated-browser-'));
const store = new Store(directory);
for (const kind of Object.keys(fixtureIds) as (keyof typeof fixtureIds)[])
  store.save(createScenario(kind));
if (process.env.MAGI_SHOWCASE === '1') store.save(createShowcase());
const runner: Runner = async (request) => {
  const persona = basename(request.directory) as Persona;
  request.onThread(request.threadId || randomUUID());
  const phase = request.prompt.startsWith('INDEPENDENT')
    ? 'independent'
    : request.prompt.startsWith('CROSS')
      ? 'cross-examination'
      : request.prompt.startsWith('RECONSIDERATION')
        ? 'reconsideration'
        : 'final-vote';
  const wait = request.prompt.includes('SLOW') ? 1600 : 350;
  await new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new Error('Test operator cancellation.'));
    };
    const timer = setTimeout(() => {
      request.signal.removeEventListener('abort', abort);
      resolve();
    }, wait);
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
  });
  if (request.prompt.includes('[TEST ERROR]') && persona === 'balthasar')
    throw new Error('Test-only Codex failure.');
  const vote: Vote = request.prompt.includes('[TEST DENIED]')
    ? persona === 'casper'
      ? 'APPROVE'
      : 'DENY'
    : request.prompt.includes('[TEST ABSTAIN]')
      ? persona === 'melchior'
        ? 'APPROVE'
        : persona === 'balthasar'
          ? 'DENY'
          : 'ABSTAIN'
      : persona === 'balthasar'
        ? 'DENY'
        : 'APPROVE';
  return {
    assessment: fixtureAssessment(persona, vote, phase),
    usage: { inputTokens: 10, outputTokens: 5, cachedTokens: 0 },
    durationMs: wait,
  };
};
const orchestrator = new Orchestrator(store, runner, async (request) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => {
        request.signal.removeEventListener('abort', abort);
        resolve();
      },
      request.prompt.includes('REPORT_SLOW') ? 1400 : 250,
    );
    const abort = () => {
      clearTimeout(timer);
      reject(new Error('Test report cancelled.'));
    };
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
  });
  if (request.prompt.includes('REPORT_ERROR')) throw new Error('Test-only synthesis failure.');
  return fixtureSynthesis(request);
});
const environment = async (): Promise<Environment> => ({
  ready: true,
  auth: 'chatgpt',
  binary: 'TEST_ONLY_NO_CODEX',
  version: 'test transport (no model calls)',
  checkedAt: new Date().toISOString(),
  capabilities: ['test-only'],
  issues: [],
  usageNotice: 'TEST SERVER — NO SUBSCRIPTION USAGE',
});
const { app } = createApp(store, orchestrator, environment);
app.get('/test-isolation', (_req, res) =>
  res.json({ testOnly: true, storage: basename(directory), realCli: false }),
);
app.post('/test-reset/:kind', (req, res) => {
  const kind = req.params.kind as keyof typeof fixtureIds;
  if (!(kind in fixtureIds)) {
    res.status(404).end();
    return;
  }
  store.save(createScenario(kind));
  res.json({ testOnly: true });
});
const vite = await attachFrontend(app);
const server = app.listen(5187, '127.0.0.1', () =>
  console.log('ISOLATED MAGI TEST SERVER http://127.0.0.1:5187'),
);
let stopping = false;
const close = () => {
  if (stopping) return;
  stopping = true;
  orchestrator.shutdown();
  server.closeAllConnections();
  server.close();
  void vite?.close();
  setTimeout(() => process.exit(0), 250);
};
process.on('SIGTERM', close);
process.on('SIGINT', close);
process.on('exit', () => rmSync(directory, { recursive: true, force: true }));
