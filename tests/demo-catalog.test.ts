import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assessmentSchema,
  finalAnswerSchema,
  decide,
  PERSONAS,
  type Locale,
} from '../shared/domain.ts';
import { createExample, exampleIds } from '../src/demo/catalog.ts';
import { recordedRun } from '../src/demo/recording.ts';
import { frameAt, playbackTimeline } from '../src/process.ts';

test('public examples have complete four-language assessments, coherent votes and no sessions or account usage', () => {
  for (const locale of ['en', 'ja', 'ko', 'zh'] as Locale[])
    for (const id of exampleIds) {
      const run = createExample(id, locale);
      assert.equal(run.records.length, 12);
      run.records.forEach((entry) => assessmentSchema.parse(entry.assessment));
      finalAnswerSchema.parse(run.answer!.content);
      assert.deepEqual(run.verdict, decide(PERSONAS.map((p) => run.cores[p].finalVote!)));
      assert.ok(!JSON.stringify(run).includes('threadId'));
      const timeline = playbackTimeline(run);
      assert.equal(frameAt(run, timeline[0].event).records.length, 0);
      assert.equal(frameAt(run, timeline[0].event).verdict, undefined);
    }
});
test('the purpose-made actual recording preserves all public stages and dissent while excluding private identifiers', () => {
  const run = recordedRun();
  assert.equal(run.status, 'completed');
  assert.equal(run.records.length, 12);
  assert.equal(run.answer?.status, 'completed');
  assert.deepEqual(run.verdict, decide(PERSONAS.map((p) => run.cores[p].finalVote!)));
  assert.deepEqual(
    [...new Set(run.records.map((r) => r.phase))],
    ['independent', 'cross-examination', 'reconsideration', 'final-vote'],
  );
  assert.ok(run.answer?.content?.disagreements.length);
  const text = JSON.stringify(run);
  assert.doesNotMatch(text, /threadId|\/Users\/|access_token|refresh_token|auth\.json/);
  assert.equal(run.settings.locale, 'en');
  for (const core of Object.values(run.cores))
    assert.deepEqual(core.usage, { inputTokens: 0, outputTokens: 0, cachedTokens: 0 });
});
