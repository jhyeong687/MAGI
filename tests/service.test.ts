import { test } from 'node:test';
import assert from 'node:assert/strict';
import { processingLight } from '../src/processingLight.ts';
import { reportText } from '../src/report.ts';
import { copies } from '../src/i18n.ts';
import { createScenario } from './fixtures/scenarios.ts';

test('processing pulses are irregular, independent by core and repeatable on recorded playback', () => {
  const samples = (seed: string) =>
    Array.from({ length: 800 }, (_, i) => processingLight(i * 50, seed));
  const first = samples('run:melchior:cross:1');
  assert.deepEqual(first, samples('run:melchior:cross:1'));
  assert.notDeepEqual(first, samples('run:balthasar:cross:1'));
  assert.notDeepEqual(first, samples('other-run:melchior:cross:1'));
  const transitions = first.flatMap((lit, i) => (i && lit !== first[i - 1] ? [i * 50] : []));
  const gaps = transitions.slice(1).map((at, i) => at - transitions[i]);
  assert.ok(transitions.length > 15);
  assert.ok(new Set(gaps).size > 6);
  assert.ok(Math.min(...gaps) >= 250);
  assert.ok(Math.max(...gaps) >= 1300);
});

test('downloaded report preserves the selected question, fixed vote, conditions and all three public opinions', () => {
  const run = createScenario('approved');
  const text = reportText(run, copies.ko);
  assert.ok(text.includes(run.question));
  assert.ok(text.includes('APPROVED · 2 / 3'));
  assert.ok(text.includes(run.answer!.content!.answer));
  for (const condition of run.answer!.content!.conditions) assert.ok(text.includes(condition));
  for (const record of run.records.filter((record) => record.phase === 'final-vote'))
    assert.ok(text.includes(record.assessment.summary));
  assert.ok(text.includes(run.id));
  assert.ok(!text.includes('threadId'));
});
