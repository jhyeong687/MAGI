import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { defaultSettings, type Run, type Persona } from '../shared/domain.ts';
import { Orchestrator } from '../server/orchestrator.ts';
import { Store } from '../server/store.ts';
import { makeSynthesisPrompt, type AnswerRunner } from '../server/synthesis.ts';
import type { Runner } from '../server/codex.ts';
import { fixtureSynthesis } from './fixtures/synthesis.ts';
import { createScenario, fixtureAssessment } from './fixtures/scenarios.ts';
import { frameAt, processTimeline } from '../src/process.ts';
const runner: Runner = async (request) => {
  const persona = basename(request.directory) as Persona;
  if (!request.threadId) request.onThread(randomUUID());
  return {
    assessment: fixtureAssessment(
      persona,
      persona === 'balthasar' ? 'DENY' : 'APPROVE',
      'final-vote',
    ),
    usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
    durationMs: 1,
  };
};
async function until(check: () => boolean) {
  const deadline = Date.now() + 2000;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('Test deadline');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
function setup(t: import('node:test').TestContext, answerRunner: AnswerRunner) {
  const directory = mkdtempSync(join(tmpdir(), 'magi-report-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = new Store(directory);
  return { store, orchestrator: new Orchestrator(store, runner, answerRunner) };
}

test('synthesis consumes all three recorded opinions, fixed verdict and actual debate without casting a fourth vote', async (t) => {
  let calls = 0;
  const { store, orchestrator } = setup(t, async (request) => {
    calls++;
    assert.equal(request.threadId, undefined);
    assert.ok(request.personaPrompt.includes('not a fourth voter'));
    const data = JSON.parse(
      request.prompt.split('<council_evidence_json>\n')[1].split('\n</council_evidence_json>')[0],
    );
    assert.equal(data.finalAssessments.length, 3);
    assert.equal(data.debate.length, 6);
    assert.equal(data.verdict.ratio, 2);
    assert.equal(data.finalAssessments[1].vote, 'DENY');
    assert.equal([...store.runs.values()][0].phase, 'report');
    return fixtureSynthesis(request);
  });
  const run = orchestrator.create('Synthesis proposal', defaultSettings, 'test-only');
  await until(() => run.status !== 'running');
  assert.equal(calls, 1);
  assert.equal(run.records.length, 12);
  assert.equal(run.answer?.status, 'completed');
  assert.equal(run.answer.usage.inputTokens, 20);
  assert.equal(run.verdict?.ratio, 2);
  assert.equal(
    new Store(store.directory).runs.get(run.id)?.answer?.content?.answer,
    run.answer.content?.answer,
  );
});

test('report failure preserves votes; retry uses one synthesis call without rerunning personas', async (t) => {
  let fail = true,
    calls = 0;
  const { orchestrator } = setup(t, async (request) => {
    calls++;
    if (fail) throw new Error('synthesis unavailable');
    return fixtureSynthesis(request);
  });
  const run = orchestrator.create('retry proposal', defaultSettings, 'test-only');
  await until(() => run.status !== 'running');
  assert.equal(run.status, 'completed');
  assert.equal(run.answer?.status, 'error');
  assert.equal(run.verdict?.result, 'APPROVED');
  const votes = structuredClone(run.verdict);
  const records = structuredClone(run.records);
  fail = false;
  orchestrator.generateAnswer(run.id, 'test-only');
  assert.throws(() => orchestrator.generateAnswer(run.id, 'test-only'));
  await until(() => run.status !== 'running');
  assert.equal(run.answer?.status, 'completed');
  assert.equal(calls, 2);
  assert.deepEqual(run.verdict, votes);
  assert.deepEqual(run.records, records);
  orchestrator.generateAnswer(run.id, 'test-only');
  assert.equal(calls, 2);
});

test('stopping report generation preserves completed votes and ignores a late answer; restart preserves votes too', async (t) => {
  let release: () => void = () => {};
  const { store, orchestrator } = setup(
    t,
    (request) =>
      new Promise((resolve) => {
        release = () => void fixtureSynthesis(request).then(resolve);
      }),
  );
  const run = orchestrator.create('cancel report', defaultSettings, 'test-only');
  await until(() => run.answer?.status === 'generating');
  const reopened = new Store(store.directory).runs.get(run.id)!;
  assert.equal(reopened.status, 'completed');
  assert.equal(reopened.answer?.status, 'error');
  assert.deepEqual(reopened.verdict, run.verdict);
  assert.equal(reopened.cores.balthasar.state, 'DENIED');
  orchestrator.cancel(run.id);
  release();
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(run.status, 'completed');
  assert.equal(run.answer?.status, 'cancelled');
  assert.equal(run.answer.content, undefined);
  assert.equal(run.verdict?.ratio, 2);
});

test('synthesis rejects missing votes or a mismatched verdict; replay never leaks later report content or usage', () => {
  const run = createScenario('approved');
  const prompt = makeSynthesisPrompt(run);
  assert.ok(prompt.includes(run.question));
  const wrong = structuredClone(run);
  wrong.verdict!.ratio = 3;
  assert.throws(() => makeSynthesisPrompt(wrong));
  wrong.records = [];
  assert.throws(() => makeSynthesisPrompt(wrong));
  const events = processTimeline(run);
  const early = frameAt(run, events[0]);
  assert.equal(early.answer, undefined);
  assert.equal(early.verdict, undefined);
  const end = frameAt(run, events.at(-1)!);
  assert.equal(end.answer?.content?.answer, run.answer?.content?.answer);
  end.answer!.usage.inputTokens = 999;
  assert.equal(run.answer?.usage.inputTokens, 20);
  const prior = structuredClone(events.at(-1)!);
  prior.answer = undefined;
  assert.equal(frameAt(run, prior).answer, undefined);
});

test('replaying a report added to old history skips days of idle time without leaking its content', async () => {
  const { playbackTimeline } = await import('../src/process.ts');
  const run = createScenario('approved');
  const terminal = structuredClone(run.events!.at(-1)!);
  const start = new Date(Date.parse(terminal.at) + 10 * 24 * 60 * 60 * 1000).toISOString();
  run.events!.push({
    ...terminal,
    at: start,
    version: terminal.version + 1,
    status: 'running',
    answer: {
      status: 'generating',
      startedAt: start,
      usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 },
    },
  });
  run.events!.push({
    ...terminal,
    at: new Date(Date.parse(start) + 1000).toISOString(),
    version: terminal.version + 2,
  });
  const timeline = playbackTimeline(run);
  assert.equal(timeline.at(-1)!.offset, 5000);
  assert.equal(frameAt(run, timeline.at(-2)!.event).answer?.content, undefined);
});

test('explicit report voice refresh preserves votes and the prior answer, and is idempotent at the current revision', async (t) => {
  const { ANSWER_REVISION } = await import('../shared/domain.ts');
  const { synthesisPolicy } = await import('../server/synthesis.ts');
  assert.match(synthesisPolicy, /non-honorific declarative register/);
  assert.match(synthesisPolicy, /never change it/);
  let fail = true,
    calls = 0;
  const { store, orchestrator } = setup(t, async (request) => {
    calls++;
    if (fail) throw new Error('Refresh unavailable');
    return fixtureSynthesis(request);
  });
  const run = createScenario('approved');
  store.save(run);
  const original = structuredClone(run);
  orchestrator.generateAnswer(run.id, 'test-only', true);
  await until(() => run.status !== 'running');
  assert.equal(run.answer?.status, 'error');
  assert.deepEqual(run.answer?.previousContent, original.answer!.content);
  assert.deepEqual(run.records, original.records);
  assert.deepEqual(run.verdict, original.verdict);
  fail = false;
  orchestrator.generateAnswer(run.id, 'test-only', true);
  await until(() => run.status !== 'running');
  assert.equal(run.answer?.status, 'completed');
  assert.equal(run.answer?.revision, ANSWER_REVISION);
  assert.deepEqual(run.answer?.previousContent, original.answer!.content);
  orchestrator.generateAnswer(run.id, 'test-only', true);
  assert.equal(calls, 2);
  assert.deepEqual(run.records, original.records);
  assert.deepEqual(run.verdict, original.verdict);
});
