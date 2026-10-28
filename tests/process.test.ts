import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultSettings,
  PERSONAS,
  type CoreState,
  type Persona,
  type Run,
} from '../shared/domain.ts';
import { corePresentation, frameAt, processTimeline, resolution } from '../src/process.ts';

function recordedRun(): Run {
  const origin = Date.parse('2026-10-28T00:00:00Z');
  const phases = ['independent', 'cross-examination', 'reconsideration', 'final-vote'] as const;
  const records = phases.flatMap((phase, group) =>
    PERSONAS.map((persona, index) => ({
      persona,
      phase,
      round: group === 0 ? 0 : 1,
      at: new Date(origin + group * 4000 + 1500 + index * 500).toISOString(),
      durationMs: 1000 + index * 500,
      assessment: {
        vote: persona === 'balthasar' ? ('DENY' as const) : ('APPROVE' as const),
        summary: `Public ${phase} ${persona}`,
        rationale: ['Public justification'],
        risks: [],
        responseToOthers: '',
        confidence: 75,
      },
    })),
  );
  return {
    id: '11111111-1111-4111-8111-111111111111',
    question: 'recorded proposal',
    status: 'completed',
    phase: 'report',
    round: 1,
    version: 30,
    createdAt: new Date(origin).toISOString(),
    updatedAt: new Date(origin + 15000).toISOString(),
    completedAt: new Date(origin + 15000).toISOString(),
    settings: structuredClone(defaultSettings),
    records,
    cores: Object.fromEntries(
      PERSONAS.map((persona) => [
        persona,
        {
          state: persona === 'balthasar' ? 'DENIED' : 'APPROVED',
          finalVote: persona === 'balthasar' ? 'DENY' : 'APPROVE',
          usage: { inputTokens: 10, outputTokens: 10, cachedTokens: 0 },
        },
      ]),
    ) as Run['cores'],
    verdict: { result: 'APPROVED', approve: 2, deny: 1, abstain: 0, ratio: 2, total: 3 },
  };
}

test('historical playback follows real response times and never reveals future records or votes', () => {
  const run = recordedRun();
  const timeline = processTimeline(run);
  assert.equal(timeline[0].recordCount, 0);
  assert.equal(timeline.at(-1)!.status, 'completed');
  assert.ok(
    timeline.every(
      (event, index) => index === 0 || Date.parse(event.at) >= Date.parse(timeline[index - 1].at),
    ),
  );
  const first = timeline.find((event) => event.recordCount === 1)!;
  const view = frameAt(run, first);
  assert.equal(view.records.length, 1);
  assert.equal(view.verdict, undefined);
  assert.equal(view.cores.balthasar.latest, undefined);
  assert.equal(view.cores.melchior.finalVote, undefined);
  assert.equal(corePresentation(view, 'melchior').pending, false);
  assert.equal(corePresentation(view, 'balthasar').pending, true);
  assert.equal(resolution(view).text, '審議中');
  const finalVote = frameAt(
    run,
    timeline.find((event) => event.recordCount === 10)!,
  );
  assert.equal(finalVote.cores.melchior.finalVote, 'APPROVE');
  assert.equal(finalVote.cores.balthasar.finalVote, undefined);
  assert.equal(finalVote.verdict, undefined);
  assert.equal(resolution(frameAt(run, timeline.at(-1)!)).text, '可決');
  assert.equal(run.records.length, 12);
});

test('recorded server events preserve stage states, token counters and interrupted terminal states', () => {
  const run = recordedRun();
  run.events = [
    {
      at: run.createdAt,
      version: 1,
      phase: 'independent',
      round: 0,
      status: 'running',
      recordCount: 0,
      cores: Object.fromEntries(
        PERSONAS.map((persona) => [
          persona,
          { state: 'ANALYZING', usage: { inputTokens: 3, outputTokens: 0, cachedTokens: 0 } },
        ]),
      ) as NonNullable<Run['events']>[number]['cores'],
    },
  ];
  run.status = 'error';
  run.verdict = undefined;
  run.cores.melchior.state = 'ERROR';
  const timeline = processTimeline(run);
  assert.equal(timeline.length, 2);
  assert.equal(timeline.at(-1)!.status, 'error');
  assert.equal(frameAt(run, timeline[0]).cores.melchior.usage.inputTokens, 3);
  assert.equal(resolution(frameAt(run, timeline.at(-1)!)).text, '障害');
});

test('queued, working, completed response, final denial and cancellation have distinct honest screen states', () => {
  const run = recordedRun();
  run.status = 'running';
  run.phase = 'independent';
  run.records = [];
  run.verdict = undefined;
  for (const persona of PERSONAS) {
    run.cores[persona].finalVote = undefined;
    run.cores[persona].state = 'STANDBY';
  }
  assert.equal(corePresentation(run, 'melchior').label, 'QUEUED');
  assert.equal(corePresentation(run, 'melchior').pending, false);
  run.cores.melchior.state = 'ANALYZING';
  assert.equal(corePresentation(run, 'melchior').pending, true);
  run.cores.balthasar.state = 'DENIED';
  run.cores.balthasar.finalVote = 'DENY';
  assert.equal(corePresentation(run, 'balthasar').tone, 'denied');
  run.status = 'cancelled';
  assert.equal(corePresentation(run, 'melchior').pending, false);
  assert.equal(resolution(run).text, '中止');
});

test('early replay never inherits terminal errors, sessions or usage, but legacy terminal totals survive', () => {
  const run = recordedRun();
  run.status = 'error';
  run.error = 'terminal error';
  for (const p of PERSONAS) {
    run.cores[p].state = 'ERROR';
    run.cores[p].error = `late ${p}`;
    run.cores[p].threadId = `session-${p}`;
  }
  const timeline = processTimeline(run);
  const first = frameAt(run, timeline[0]);
  assert.equal(first.error, undefined);
  for (const p of PERSONAS) {
    assert.equal(first.cores[p].error, undefined);
    assert.equal(first.cores[p].threadId, undefined);
    assert.equal(first.cores[p].usage.inputTokens, 0);
  }
  const last = frameAt(run, timeline.at(-1)!);
  assert.equal(last.error, 'terminal error');
  assert.equal(last.cores.melchior.threadId, 'session-melchior');
  assert.equal(last.cores.melchior.usage.inputTokens, 10);
});
