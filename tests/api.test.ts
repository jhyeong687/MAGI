import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { get as httpGet } from 'node:http';
import { createApp } from '../server/app.ts';
import { Orchestrator } from '../server/orchestrator.ts';
import { Store } from '../server/store.ts';
import type { Environment } from '../shared/domain.ts';

test('local API validates inputs, rejects cross-origin and rebinding, and SSE reconnects with a snapshot', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'magi-api-'));
  const store = new Store(directory);
  const orchestrator = new Orchestrator(store, async () => new Promise(() => {}));
  let ready = true;
  const environment = async (): Promise<Environment> => ({
    ready,
    binary: '/test-only',
    auth: 'chatgpt',
    checkedAt: new Date().toISOString(),
    issues: ['Not ready'],
    capabilities: [],
    usageNotice: '',
  });
  const { app } = createApp(store, orchestrator, environment);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    orchestrator.shutdown();
    server.closeAllConnections();
    server.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const address = server.address() as { port: number };
  const base = `http://127.0.0.1:${address.port}`;
  const post = (body: unknown, headers = {}) =>
    fetch(`${base}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  assert.equal((await post({ question: ' ' })).status, 400);
  assert.equal((await post({ question: 'test' }, { Origin: 'https://evil.example' })).status, 403);
  const rebound = await new Promise<number | undefined>((resolve) =>
    httpGet(`${base}/api/settings`, { headers: { Host: 'evil.example' } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    }),
  );
  assert.equal(rebound, 403);
  ready = false;
  assert.equal((await post({ question: 'test' })).status, 503);
  ready = true;
  const response = await post({ question: '실제 서버 입력 검증' });
  assert.equal(response.status, 201);
  const run = await response.json();
  assert.equal((await post({ question: 'second' })).status, 409);
  assert.equal((await fetch(`${base}/api/auth/login`, { method: 'POST' })).status, 409);
  assert.equal(
    (
      await fetch(`${base}/api/auth/login`, {
        method: 'POST',
        headers: { Origin: 'https://evil.example' },
      })
    ).status,
    403,
  );
  for (let i = 0; i < 2; i++) {
    const stream = await fetch(`${base}/api/runs/${run.id}/events`);
    assert.match(stream.headers.get('content-type')!, /text\/event-stream/);
    const reader = stream.body!.getReader();
    const chunk = await reader.read();
    const text = new TextDecoder().decode(chunk.value);
    assert.match(text, /event: snapshot/);
    assert.match(text, /실제 서버 입력 검증/);
    await reader.cancel();
  }
  const catalog = await fetch(`${base}/api/events`, { signal: AbortSignal.timeout(5000) });
  const globalReader = catalog.body!.getReader();
  const decode = (value: Uint8Array | undefined) => new TextDecoder().decode(value);
  assert.match(decode((await globalReader.read()).value), /event: catalog/);
  assert.equal(orchestrator.listenerCount('change'), 1);
  await fetch(`${base}/api/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...store.settings, sound: true }),
  });
  assert.match(decode((await globalReader.read()).value), /"sound":true/);
  const stop = await fetch(`${base}/api/runs/${run.id}/cancel`, { method: 'POST' });
  assert.match(decode((await globalReader.read()).value), /"status":"cancelled"/);
  await globalReader.cancel();
  assert.equal((await stop.json()).status, 'cancelled');
  const login = await fetch(`${base}/api/auth/login`, { method: 'POST' });
  assert.deepEqual(await login.json(), { status: 'completed' });
  assert.deepEqual(await (await fetch(`${base}/api/auth`)).json(), { status: 'completed' });
  const history = await (await fetch(`${base}/api/runs`)).json();
  assert.equal(history[0].status, 'cancelled');
  assert.equal((await fetch(`${base}/api/runs/not-a-uuid`)).status, 404);
});

test('historical answer endpoint preserves vote records and completed answers are idempotent', async (t) => {
  const { createScenario, fixtureIds } = await import('./fixtures/scenarios.ts');
  const { fixtureSynthesis } = await import('./fixtures/synthesis.ts');
  const directory = mkdtempSync(join(tmpdir(), 'magi-answer-api-'));
  const store = new Store(directory);
  const source = createScenario('legacy');
  store.save(source);
  let calls = 0,
    ready = true;
  const orchestrator = new Orchestrator(
    store,
    async () => {
      throw new Error('Personas must not rerun');
    },
    async (request) => {
      calls++;
      return fixtureSynthesis(request);
    },
  );
  const environment = async (): Promise<Environment> => ({
    ready,
    binary: 'test-only',
    auth: 'chatgpt',
    checkedAt: new Date().toISOString(),
    issues: ['not ready'],
    capabilities: [],
    usageNotice: '',
  });
  const { app } = createApp(store, orchestrator, environment);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => {
    orchestrator.shutdown();
    server.closeAllConnections();
    server.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = (id: string) => fetch(`${base}/api/runs/${id}/answer`, { method: 'POST' });
  assert.equal((await post('missing')).status, 404);
  ready = false;
  assert.equal((await post(source.id)).status, 503);
  ready = true;
  const before = structuredClone(source.records);
  const votes = structuredClone(source.verdict);
  assert.equal((await post(source.id)).status, 202);
  const deadline = Date.now() + 1000;
  while (source.status === 'running') {
    if (Date.now() > deadline) throw new Error('Answer timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.equal(source.answer?.status, 'completed');
  assert.equal(calls, 1);
  assert.deepEqual(source.records, before);
  assert.deepEqual(source.verdict, votes);
  assert.equal((await post(source.id)).status, 200);
  assert.equal(calls, 1);
});
