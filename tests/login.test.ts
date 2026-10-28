import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { LoginManager } from '../server/login.ts';
import type { Environment } from '../shared/domain.ts';

const environment = (ready: boolean): Environment => ({
  ready,
  auth: ready ? 'chatgpt' : 'missing',
  binary: 'test-only',
  checkedAt: new Date().toISOString(),
  capabilities: [],
  issues: [],
  usageNotice: '',
});
const child = () =>
  Object.assign(new EventEmitter(), {
    killed: false,
    kill() {
      this.killed = true;
      return true;
    },
  }) as unknown as ChildProcess;
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('each local login uses the selected CLI once, waits for real auth, and completed auth is idempotent', async () => {
  let ready = false,
    launches = 0;
  const process = child();
  const login = new LoginManager(
    async () => environment(ready),
    (binary) => {
      assert.equal(binary, 'test-only');
      launches++;
      return process;
    },
  );
  assert.equal((await login.start()).status, 'pending');
  assert.equal((await login.start()).status, 'pending');
  assert.equal(launches, 1);
  ready = true;
  process.emit('close', 0);
  await settle();
  assert.equal(login.snapshot().status, 'completed');
  assert.equal((await login.start()).status, 'completed');
  assert.equal(launches, 1);
  assert.ok(!JSON.stringify(login.snapshot()).includes('token'));
});

test('failed sign-in is a generic error and cancellation ignores late success without deleting credentials', async () => {
  const process = child();
  const login = new LoginManager(
    async () => environment(false),
    () => process,
  );
  await login.start();
  process.emit('error', new Error('Bearer secret-credential'));
  await settle();
  assert.equal(login.snapshot().status, 'error');
  assert.ok(!JSON.stringify(login.snapshot()).includes('secret-credential'));
  await login.start();
  login.cancel();
  process.emit('close', 0);
  await settle();
  assert.equal(process.killed, true);
  assert.equal(login.snapshot().status, 'idle');
});

test('cancel during environment detection cannot start an obsolete login process', async () => {
  let finish: (env: Environment) => void = () => {};
  let launches = 0;
  const login = new LoginManager(
    () => new Promise((resolve) => (finish = resolve)),
    () => {
      launches++;
      return child();
    },
  );
  const waiting = login.start();
  login.cancel();
  finish(environment(false));
  await waiting;
  assert.equal(launches, 0);
  assert.equal(login.snapshot().status, 'idle');
});

test('a late auth check from an older attempt cannot overwrite a newer attempt', async () => {
  const processes: ChildProcess[] = [];
  let checks = 0,
    finish: (env: Environment) => void = () => {};
  const login = new LoginManager(
    async () => {
      checks++;
      if (checks === 2) return new Promise((resolve) => (finish = resolve));
      return environment(false);
    },
    () => {
      const process = child();
      processes.push(process);
      return process;
    },
  );
  await login.start();
  processes[0].emit('close', 0);
  await settle();
  login.cancel();
  await login.start();
  finish(environment(true));
  await settle();
  assert.equal(login.snapshot().status, 'pending');
  login.cancel();
});
