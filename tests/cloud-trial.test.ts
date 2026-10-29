import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyQuota,
  quotaStatus,
  reserve,
  TRIAL_POLICY,
  TrialError,
  nextReset,
  validQuestion,
} from '../cloudflare/policy.ts';
import { freeSubscriptions, checkFreePlan } from '../cloudflare/billing.ts';
import {
  cloudInput,
  createTrialRun,
  deliberate,
  modelContent,
  personaPrompt,
  reportPrompt,
  type Model,
  type ModelRequest,
} from '../cloudflare/protocol.ts';
import { trialEndpoint } from '../src/demo/trialClient.ts';
import { trialCopies } from '../src/demo/trialCopy.ts';
import { PERSONAS, type Assessment, type Run } from '../shared/domain.ts';
const assessment = (vote: Assessment['vote'] = 'APPROVE'): Assessment => ({
  vote,
  summary: 'Approve only after verification.',
  rationale: ['Evidence is incomplete.'],
  risks: ['Time is limited.'],
  responseToOthers: '',
  confidence: 60,
});
const report = {
  answer: 'Conditional approval. Verify first.',
  keyReasons: ['MELCHIOR-1 requires evidence.'],
  conditions: ['Verify.'],
  disagreements: ['BALTHASAR-2 rejects without support.'],
  brief: {
    conclusion: 'Conditional approval.',
    nextSteps: ['Verify.'],
    keyObjection: 'BALTHASAR-2 rejects without support.',
  },
};

test('trial counters reserve the full run, never refund failures, enforce per-IP/global/concurrency limits and reject duplicates', () => {
  const now = Date.parse('2026-10-29T12:00:00Z'),
    state = emptyQuota();
  reserve(state, 'first', 'a', now);
  reserve(state, 'second', 'b', now);
  assert.throws(() => reserve(state, 'third', 'c', now), /busy/);
  delete state.active.a;
  delete state.active.b;
  assert.throws(() => reserve(state, 'first', 'a', now), /duplicate/);
  reserve(state, 'first', 'c', now);
  delete state.active.c;
  assert.throws(() => reserve(state, 'first', 'd', now), /client_limit/);
  for (let i = 3; i < 20; i++) {
    reserve(state, `ip-${i}`, `run-${i}`, now);
    delete state.active[`run-${i}`];
  }
  assert.equal(state.used, 20);
  assert.equal(quotaStatus(state, 'new', now).remainingStarts, 0);
  assert.throws(() => reserve(state, 'new', 'x', now), /daily_limit/);
  const closed = emptyQuota();
  closed.closed = true;
  assert.throws(() => reserve(closed, 'new', 'x', now), /provider_limit/);
  assert.equal(new Date(nextReset(now)).toISOString(), '2026-10-30T00:00:00.000Z');
  const expired = emptyQuota();
  reserve(expired, 'ip', 'id', now);
  assert.equal(quotaStatus(expired, 'new', now + 400000).active, 0);
});

test('free plan verification rejects paid, unknown, partial, malformed and inaccessible billing state', async () => {
  assert.equal(freeSubscriptions({ success: true, result: [] }), true);
  assert.equal(
    freeSubscriptions({ success: true, result: [{ rate_plan: { id: 'workers_free' }, price: 0 }] }),
    true,
  );
  for (const body of [
    null,
    {},
    { success: false, result: [] },
    { success: true, result: [{}] },
    { success: true, result: [], result_info: { total_pages: 2 } },
    { success: true, result: [{ rate_plan: { id: 'workers_paid' } }] },
    { success: true, result: [{ rate_plan: { id: 'workers_standard' }, price: 0 }] },
    { success: true, result: [{ rate_plan: { id: 'workers_free' }, price: 5 }] },
  ])
    assert.equal(freeSubscriptions(body), false);
  let calls = 0;
  const fail = (async () => {
    calls++;
    throw new Error('network');
  }) as typeof fetch;
  assert.equal(await checkFreePlan('', '', fail), false);
  assert.equal(calls, 0);
  assert.equal(await checkFreePlan('a'.repeat(32), 'read-token', fail), false);
});

test('questions and configured public endpoints are bounded without leaking credentials or accepting arbitrary hosts', () => {
  assert.equal(validQuestion('あ'.repeat(800)), true);
  assert.equal(validQuestion('😀'.repeat(800)), false);
  assert.equal(validQuestion('a'.repeat(801)), false);
  assert.equal(validQuestion('  '), false);
  assert.equal(
    trialEndpoint('https://magi-free-trial.example.workers.dev'),
    'https://magi-free-trial.example.workers.dev',
  );
  for (const value of [
    'http://example.workers.dev',
    'https://example.com',
    'https://example.workers.dev.evil.com',
    'https://user:secret@example.workers.dev',
    'https://example.workers.dev/?token=secret',
    'https://example.workers.dev/api',
    'bad',
  ])
    assert.equal(trialEndpoint(value), '');
  for (const locale of ['en', 'ja', 'ko', 'zh'] as const) {
    assert.deepEqual(Object.keys(trialCopies[locale]).sort(), Object.keys(trialCopies.en).sort());
    assert.deepEqual(
      Object.keys(trialCopies[locale].errors).sort(),
      Object.keys(trialCopies.en.errors).sort(),
    );
  }
});

test('cloud deliberation performs 13 genuine calls with independent stage snapshots and deterministic votes', async () => {
  const run = createTrialRun('Should we ship?', 'en');
  const calls: ModelRequest[] = [];
  const views: Run[] = [];
  const model: Model = async (request) => {
    calls.push(request);
    if (request.prompt.includes('NOT a fourth voter')) return { response: report };
    const vote = request.prompt.startsWith('You are BALTHASAR') ? 'DENY' : 'APPROVE';
    await new Promise((resolve) => setTimeout(resolve, vote === 'DENY' ? 8 : 1));
    return { response: assessment(vote), usage: { prompt_tokens: 100, completion_tokens: 50 } };
  };
  await deliberate(run, model, (snapshot) => views.push(snapshot), new AbortController().signal);
  assert.equal(calls.length, TRIAL_POLICY.callsPerRun);
  assert.equal(run.records.length, 12);
  assert.equal(run.status, 'completed');
  assert.equal(run.verdict?.result, 'APPROVED');
  assert.equal(run.verdict?.deny, 1);
  assert.deepEqual(run.answer?.content, report);
  for (const request of calls.slice(0, 3)) {
    assert.match(request.prompt, /"peers":\[\]/);
    assert.doesNotMatch(request.prompt, /Approve only after verification/);
  }
  for (const request of calls.slice(3, 6))
    assert.equal((request.prompt.match(/"summary"/g) || []).length, 3);
  assert.equal(views.find((view) => view.phase === 'cross-examination')?.records.length, 3);
  assert.equal(views.find((view) => view.phase === 'report')?.records.length, 12);
  assert.ok(views.some((view) => view.phase === 'independent' && view.records.length === 1));
  assert.match(calls.at(-1)!.prompt, /"deny":1/);
  assert.ok(
    calls.every(
      (request) => new TextEncoder().encode(request.prompt).length <= TRIAL_POLICY.promptBytes,
    ),
  );
});

test('provider exhaustion never invents votes, retries calls, or invokes synthesis; report failure preserves votes', async () => {
  const run = createTrialRun('A proposal', 'ja');
  let calls = 0;
  await deliberate(
    run,
    async () => {
      calls++;
      throw new TrialError('provider_limit');
    },
    () => {},
    new AbortController().signal,
  );
  assert.equal(calls, 3);
  assert.equal(run.status, 'error');
  assert.equal(run.error, 'provider_limit');
  assert.equal(run.verdict, undefined);
  assert.equal(run.records.length, 0);
  const voted = createTrialRun('Another proposal', 'ko');
  calls = 0;
  await deliberate(
    voted,
    async (request) => {
      calls++;
      return {
        response: request.prompt.includes('NOT a fourth voter') ? { broken: true } : assessment(),
      };
    },
    () => {},
    new AbortController().signal,
  );
  assert.equal(calls, 13);
  assert.equal(voted.status, 'completed');
  assert.equal(voted.verdict?.approve, 3);
  assert.equal(voted.answer?.status, 'error');
});

test('aborting a cloud decision prevents later stages, and malformed / reasoning-prefixed model output is rejected', async () => {
  const abort = new AbortController(),
    run = createTrialRun('A proposal', 'zh');
  let calls = 0;
  await deliberate(
    run,
    async () => {
      calls++;
      abort.abort();
      return { response: assessment() };
    },
    () => {},
    abort.signal,
  );
  assert.ok(calls <= 3);
  assert.equal(run.records.length, 0);
  assert.equal(run.verdict, undefined);
  assert.throws(
    () => modelContent({ response: '<think>private</think>{"vote":"APPROVE"}' }),
    /model_error/,
  );
  assert.deepEqual(modelContent({ response: '```json\n{"ok":true}\n```' }).content, { ok: true });
});

test('maximum permitted question and public evidence fit the prompt ceiling in all four languages', () => {
  for (const locale of ['en', 'ja', 'ko', 'zh'] as const) {
    const run = createTrialRun('あ'.repeat(800), locale);
    const snapshot = Object.fromEntries(PERSONAS.map((p) => [p, assessment()]));
    for (const p of PERSONAS)
      for (const phase of [
        'independent',
        'cross-examination',
        'reconsideration',
        'final-vote',
      ] as const)
        assert.ok(
          new TextEncoder().encode(personaPrompt(run, p, phase, snapshot)).length <=
            TRIAL_POLICY.promptBytes,
        );
    for (const p of PERSONAS) {
      run.cores[p].latest = assessment();
      run.cores[p].finalVote = 'APPROVE';
    }
    run.verdict = { result: 'APPROVED', approve: 3, deny: 0, abstain: 0, ratio: 3, total: 3 };
    assert.ok(new TextEncoder().encode(reportPrompt(run)).length <= TRIAL_POLICY.promptBytes);
  }
});

test('Cloudflare transport uses explicit chat roles and an actual array schema, never raw completion mode', () => {
  const input = cloudInput({
    prompt: 'UNTRUSTED PROPOSAL /no_think',
    max_tokens: 640,
    response_format: {
      type: 'json_schema',
      json_schema: {
        type: 'object',
        properties: { rationale: { type: 'array', items: { type: 'string' } } },
      },
    },
    temperature: 0.5,
  });
  assert.equal(input.messages[0].role, 'system');
  assert.match(input.messages[0].content, /array fields must be arrays/);
  assert.equal(input.messages[1].role, 'user');
  assert.equal(input.messages[1].content, 'UNTRUSTED PROPOSAL /no_think');
  assert.equal('prompt' in input, false);
  assert.equal(input.max_tokens, 640);
});
