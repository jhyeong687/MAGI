import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  defaultSettings,
  PERSONAS,
  decide,
  type Assessment,
  type Persona,
  type Run,
} from '../shared/domain.ts';
import { Orchestrator } from '../server/orchestrator.ts';
import { Store } from '../server/store.ts';
import { fixtureSynthesis } from './fixtures/synthesis.ts';
import type { Invocation, Runner } from '../server/codex.ts';

export const assessment = (
  vote: Assessment['vote'] = 'APPROVE',
  summary = '공개 판단 요약',
): Assessment => ({
  vote,
  summary,
  rationale: ['확인 가능한 근거'],
  risks: ['조건을 확인해야 합니다.'],
  responseToOthers: '',
  confidence: 72,
});
async function finished(run: Run) {
  const deadline = Date.now() + 4000;
  while (run.status === 'running') {
    if (Date.now() > deadline) throw new Error('Test run did not finish.');
    await new Promise((r) => setTimeout(r, 5));
  }
  return run;
}

test('all 27 vote combinations use a fixed three-person denominator and explicit abstention', () => {
  for (const a of ['APPROVE', 'DENY', 'ABSTAIN'] as const)
    for (const b of ['APPROVE', 'DENY', 'ABSTAIN'] as const)
      for (const c of ['APPROVE', 'DENY', 'ABSTAIN'] as const) {
        const votes = [a, b, c];
        const result = decide(votes);
        assert.equal(
          result.result,
          votes.filter((v) => v === 'APPROVE').length >= 2
            ? 'APPROVED'
            : votes.filter((v) => v === 'DENY').length >= 2
              ? 'DENIED'
              : 'INCONCLUSIVE',
        );
        assert.equal(result.approve + result.deny + result.abstain, 3);
        assert.equal(result.total, 3);
      }
  assert.throws(() => decide(['APPROVE']));
});

test('12 calls are isolated by actual session, and peers are a completed-round snapshot', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'magi-engine-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = new Store(directory);
  const calls: Invocation[] = [];
  const ids = Object.fromEntries(PERSONAS.map((p) => [p, randomUUID()]));
  const runner: Runner = async (request) => {
    calls.push(request);
    const persona = basename(request.directory) as Persona;
    const stage = request.prompt.split('\n')[0];
    const initial = stage.includes('INDEPENDENT ANALYSIS');
    assert.ok(
      request.personaPrompt.includes(
        persona === 'melchior'
          ? 'THE SCIENTIST'
          : persona === 'balthasar'
            ? 'THE MOTHER'
            : 'THE WOMAN',
      ),
    );
    if (initial) {
      assert.equal(request.threadId, undefined);
      assert.ok(!request.prompt.includes('peer_assessments_json'));
      request.onThread(ids[persona]);
    } else {
      assert.equal(request.threadId, ids[persona]);
      const peers = JSON.parse(
        request.prompt.split('<peer_assessments_json>\n')[1].split('\n</peer_assessments_json>')[0],
      );
      assert.equal(peers.length, 2);
      assert.ok(
        peers.every((p: { persona: string }) => !p.persona.toLowerCase().includes(persona)),
      );
    }
    // Deliberately finish each core at different times to catch same-round leakage.
    await new Promise((resolve) =>
      setTimeout(resolve, persona === 'melchior' ? 2 : persona === 'casper' ? 15 : 30),
    );
    if (!initial) {
      const peers = JSON.parse(
        request.prompt.split('<peer_assessments_json>\n')[1].split('\n</peer_assessments_json>')[0],
      );
      const previous = stage.includes('CROSS EXAMINATION')
        ? 'INDEPENDENT ANALYSIS'
        : stage.includes('RECONSIDERATION')
          ? 'CROSS EXAMINATION'
          : 'RECONSIDERATION';
      assert.ok(peers.every((p: { summary: string }) => p.summary.startsWith(previous)));
    }
    return {
      assessment: assessment(persona === 'balthasar' ? 'DENY' : 'APPROVE', stage.split('.')[0]),
      usage: { inputTokens: 10, outputTokens: 5, cachedTokens: 0 },
      durationMs: 10,
    };
  };
  const orchestrator = new Orchestrator(store, runner, fixtureSynthesis);
  const settings = structuredClone(defaultSettings);
  const run = orchestrator.create('질문입니다.', settings, 'test-only');
  settings.prompts.melchior = 'MUTATED AFTER START';
  await finished(run);
  assert.equal(run.status, 'completed');
  assert.equal(run.verdict?.result, 'APPROVED');
  assert.equal(run.verdict.ratio, 2);
  assert.equal(calls.length, 12);
  assert.equal(run.records.length, 12);
  assert.ok(run.events!.length >= 18);
  assert.equal(run.events!.at(-1)!.status, 'completed');
  assert.equal(run.events!.find((event) => event.status === 'completed')!.recordCount, 12);
  assert.ok(run.events!.some((event) => event.phase === 'final-vote' && event.recordCount === 9));
  assert.equal(new Set(PERSONAS.map((p) => run.cores[p].threadId)).size, 3);
  assert.ok(!run.settings.prompts.melchior.includes('MUTATED'));
  for (const p of PERSONAS) assert.equal(run.cores[p].usage.inputTokens, 40);
  const reopened = new Store(directory);
  assert.deepEqual(reopened.runs.get(run.id)?.verdict, run.verdict);
});

test('failure aborts peers, keeps ERROR and never creates a final verdict', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'magi-failure-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const runner: Runner = (request) =>
    new Promise((resolve, reject) => {
      if (basename(request.directory) === 'balthasar') {
        setTimeout(() => reject(new Error('Rate limit reached')), 5);
        return;
      }
      request.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
  const orchestrator = new Orchestrator(new Store(directory), runner, fixtureSynthesis);
  const run = orchestrator.create('proposal', defaultSettings, 'test-only');
  await finished(run);
  assert.equal(run.status, 'error');
  assert.equal(run.verdict, undefined);
  assert.match(run.error!, /Rate limit/);
  assert.equal(run.cores.balthasar.state, 'ERROR');
});

test('cancel cannot later become APPROVED and a second concurrent decision is rejected', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'magi-cancel-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const runner: Runner = async (request) => {
    await new Promise((r) => setTimeout(r, 40));
    return {
      assessment: assessment(),
      usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
      durationMs: 40,
    };
  };
  const orchestrator = new Orchestrator(new Store(directory), runner, fixtureSynthesis);
  const run = orchestrator.create('proposal', defaultSettings, 'test-only');
  assert.throws(() => orchestrator.create('another', defaultSettings, 'test-only'), /running/);
  await new Promise((r) => setTimeout(r, 5));
  orchestrator.cancel(run.id);
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(run.status, 'cancelled');
  assert.equal(run.records.length, 0);
  assert.equal(run.verdict, undefined);
});

test('restart marks interrupted decisions ERROR without synthesizing votes', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'magi-restart-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const store = new Store(directory);
  const runner: Runner = async () => {
    throw new Error('unused');
  };
  const orchestrator = new Orchestrator(store, runner, fixtureSynthesis);
  const run = orchestrator.create('proposal', defaultSettings, 'test-only');
  const reopened = new Store(directory);
  assert.equal(reopened.runs.get(run.id)?.status, 'error');
  assert.equal(reopened.runs.get(run.id)?.verdict, undefined);
  orchestrator.cancel(run.id);
});

test('additional discussion cycles run both critique and reconsideration without skipping final voting', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'magi-cycles-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const cycles of [2, 3]) {
    const store = new Store(join(directory, String(cycles)));
    const runner: Runner = async (request) => {
      if (!request.threadId) request.onThread(randomUUID());
      return {
        assessment: assessment('ABSTAIN'),
        usage: { inputTokens: 1, outputTokens: 1, cachedTokens: 0 },
        durationMs: 1,
      };
    };
    const orchestrator = new Orchestrator(store, runner, fixtureSynthesis);
    const run = orchestrator.create(
      'not enough information',
      { ...defaultSettings, discussionRounds: cycles },
      'test-only',
    );
    await finished(run);
    assert.equal(run.records.length, 6 + 6 * cycles);
    assert.equal(run.verdict?.result, 'INCONCLUSIVE');
    assert.equal(run.records.filter((r) => r.phase === 'final-vote').length, 3);
    assert.equal(
      run.records.filter((r) => r.phase === 'reconsideration' && r.round === cycles).length,
      3,
    );
  }
});
