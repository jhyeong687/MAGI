import { test } from 'node:test';
import assert from 'node:assert/strict';
import { finalAnswerSchema, type Locale } from '../shared/domain.ts';
import { experienceCopies } from '../src/experienceCopy.ts';
import {
  composeQuestion,
  mergeQuestion,
  questionTemplate,
  questionTopics,
} from '../src/questionGuide.ts';
import { answerBrief, firstSentence } from '../src/answerBrief.ts';
import { frameAt, phaseProgress } from '../src/process.ts';
import { createScenario } from './fixtures/scenarios.ts';

test('four-language question templates compose user-editable context without mutating templates or unrelated drafts', () => {
  for (const locale of ['en', 'ko', 'ja', 'zh'] as Locale[]) {
    assert.deepEqual(
      Object.keys(experienceCopies[locale]).sort(),
      Object.keys(experienceCopies.en).sort(),
    );
    assert.ok(
      Object.values(experienceCopies[locale]).every(
        (value) => typeof value === 'string' && value.length,
      ),
    );
    for (const topic of questionTopics) {
      const draft = questionTemplate(locale, topic);
      assert.ok(draft.context && draft.decision && draft.criteria);
      const original = structuredClone(draft);
      draft.criteria += ' PRIVATE NOTE';
      const block = composeQuestion(draft, locale);
      assert.ok(block.includes('PRIVATE NOTE'));
      assert.ok(block.length < 6000);
      assert.deepEqual(questionTemplate(locale, topic), original);
      const combined = mergeQuestion('My own question', block);
      assert.ok(combined.startsWith('My own question\n\n'));
      assert.equal(mergeQuestion(combined, block), combined);
      assert.equal(
        mergeQuestion(combined, 'Revised helper text', block),
        'My own question\n\nRevised helper text',
      );
      assert.equal(
        mergeQuestion(combined + '\nMy manual addition', 'New block', block),
        combined + '\nMy manual addition\n\nNew block',
      );
    }
  }
});

test('legacy answer briefs preserve conditional wording and saved evidence without generation or source mutation', () => {
  const run = createScenario('approved');
  const content = run.answer!.content!;
  content.answer = '조건부로 승인한다. 실행 전에 검증하라.';
  content.conditions = ['첫 번째 조건', '두 번째 조건', '세 번째 조건', '네 번째 조건'];
  content.disagreements = ['BALTHASAR-2는 책임 배분에 반대한다.', '별도의 우려'];
  const before = JSON.stringify(content);
  const brief = answerBrief(content, 'ko');
  assert.equal(brief.conclusion, '조건부로 승인한다.');
  assert.deepEqual(brief.nextSteps, content.conditions.slice(0, 3));
  assert.equal(brief.keyObjection, content.disagreements[0]);
  assert.equal(brief.extracted, true);
  brief.nextSteps[0] = 'Changed presentation';
  assert.equal(JSON.stringify(content), before);
  assert.equal(firstSentence('条件付きで承認する。先に検証せよ。', 'ja'), '条件付きで承認する。');
  assert.equal(firstSentence('暂缓判断。先补足资料。', 'zh'), '暂缓判断。');
  assert.equal(
    firstSentence('Approve only after verification. Preserve the dissent.', 'en'),
    'Approve only after verification.',
  );
});

test('structured briefs are optional for old records, bounded for new answers and do not fabricate missing actions or dissent', () => {
  const content = createScenario('approved').answer!.content!;
  assert.equal(finalAnswerSchema.parse(content).brief, undefined);
  const next = finalAnswerSchema.parse({
    ...content,
    disagreements: [],
    brief: { conclusion: '条件付きで承認する。', nextSteps: [], keyObjection: '' },
  });
  assert.deepEqual(answerBrief(next, 'ja'), {
    conclusion: '条件付きで承認する。',
    nextSteps: [],
    keyObjection: '',
    extracted: false,
  });
  assert.equal(
    answerBrief({ ...next, disagreements: ['Recorded minority objection'] }, 'ja').keyObjection,
    'Recorded minority objection',
  );
  assert.throws(() =>
    finalAnswerSchema.parse({
      ...content,
      brief: { conclusion: 'Approve.', nextSteps: ['1', '2', '3', '4'], keyObjection: '' },
    }),
  );
  const empty = answerBrief({ ...content, conditions: [], disagreements: [] }, 'ko');
  assert.deepEqual(empty.nextSteps, []);
  assert.equal(empty.keyObjection, '');
});

test('stage progress counts only received opinions in the visible round, including replay snapshots and the separate report stage', () => {
  const run = createScenario('approved');
  const two = frameAt(
    run,
    run.events!.find((event) => event.recordCount === 2)!,
  );
  assert.equal(phaseProgress(two).received, 2);
  assert.deepEqual(phaseProgress(two).waiting, ['casper']);
  assert.equal(phaseProgress(two).latestAt, Date.parse(two.records.at(-1)!.at));
  two.records.push(structuredClone(two.records[0]));
  assert.equal(phaseProgress(two).received, 2);
  const next = frameAt(
    run,
    run.events!.find((event) => event.phase === 'cross-examination')!,
  );
  assert.equal(next.records.length, 3);
  assert.equal(phaseProgress(next).received, 0);
  next.round = 2;
  assert.equal(phaseProgress(next).received, 0);
  assert.equal(phaseProgress(run).received, 3);
  assert.deepEqual(phaseProgress(run).waiting, []);
});
