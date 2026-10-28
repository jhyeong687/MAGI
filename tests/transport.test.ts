import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { buildArguments, runCodex, childEnvironment, type Invocation } from '../server/codex.ts';

const binary = resolve('tests/fixtures/codex.cjs');
chmodSync(binary, 0o755);
function setup(t: TestContext, prompt: string, controller = new AbortController()): Invocation {
  const directory = mkdtempSync(join(tmpdir(), 'magi-transport-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return {
    binary,
    directory,
    prompt,
    personaPrompt: 'test persona',
    timeoutMs: 2000,
    signal: controller.signal,
    onThread: () => {},
  };
}
test('JSONL preserves split Korean characters, consumes only public output and reports actual usage', async (t) => {
  const result = await runCodex(setup(t, 'VALID'));
  assert.equal(result.assessment.summary, '한국어 응답이 손상되지 않아야 합니다.');
  assert.ok(!JSON.stringify(result).includes('SECRET_INTERNAL'));
  assert.deepEqual(result.usage, { inputTokens: 10, outputTokens: 20, cachedTokens: 3 });
});
test('malformed JSONL, invalid votes and failed turns are errors, not fallback votes', async (t) => {
  for (const prompt of ['MALFORMED', 'INVALID', 'RATE_LIMIT'])
    await assert.rejects(runCodex(setup(t, prompt)));
});
test('hung subprocess is terminated on timeout', async (t) => {
  const request = setup(t, 'HANG');
  request.timeoutMs = 120;
  const start = Date.now();
  await assert.rejects(runCodex(request), /timed out/);
  assert.ok(Date.now() - start < 2000);
});
test('operator cancellation terminates subprocess and an already-aborted request never starts', async (t) => {
  const controller = new AbortController();
  const promise = runCodex(setup(t, 'HANG', controller));
  setTimeout(() => controller.abort(), 100);
  await assert.rejects(promise, /Cancelled/);
  await assert.rejects(runCodex(setup(t, 'VALID', controller)), /Cancelled/);
});
test('CLI arguments enforce saved ChatGPT auth and read-only; proposal never becomes a shell command', (t) => {
  const request = setup(t, '$(touch /tmp/should-not-exist)');
  const args = buildArguments(request, '/tmp/schema.json');
  assert.ok(args.includes('forced_login_method="chatgpt"'));
  assert.ok(args.includes('read-only'));
  assert.ok(!args.includes(request.prompt));
  assert.equal(args.at(-1), '-');
  assert.ok(!('OPENAI_API_KEY' in childEnvironment()));
  request.threadId = 'some-session';
  const resume = buildArguments(request, '/tmp/schema.json');
  assert.equal(resume[1], 'resume');
  assert.equal(resume.at(-2), 'some-session');
});

test('the same isolated CLI transport parses a synthesis schema and excludes private reasoning', async (t) => {
  const { runSynthesis } = await import('../server/synthesis.ts');
  const result = await runSynthesis(setup(t, 'SYNTHESIS'));
  assert.equal(result.content.answer, '공개 종합 답변입니다.');
  assert.ok(!JSON.stringify(result).includes('SECRET_INTERNAL'));
  assert.equal(result.usage.outputTokens, 20);
  await assert.rejects(runSynthesis(setup(t, 'VALID')), /Invalid Codex result/);
});
