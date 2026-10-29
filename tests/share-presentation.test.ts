import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardExcerpt, publicVerdictLink, type PublicExample } from '../src/sharePresentation.ts';
import { demoPresentation } from '../src/demo/presentation.ts';
import { recordedRun } from '../src/demo/recording.ts';

test('share URLs preserve only allowed public examples, language and result, never private run data', () => {
  assert.equal(publicVerdictLink('en'), 'https://jhyeong687.github.io/MAGI/');
  for (const locale of ['en', 'ja', 'ko', 'zh'] as const) {
    for (const example of ['club', 'feature', 'meeting', 'recording'] as const) {
      const link = new URL(publicVerdictLink(locale, example));
      assert.deepEqual(Object.fromEntries(link.searchParams), {
        lang: locale,
        example,
        view: 'result',
      });
    }
  }
  assert.equal(
    publicVerdictLink('en', 'private-question-secret' as PublicExample),
    'https://jhyeong687.github.io/MAGI/',
  );
});
test('public card titles and conclusions fit the editor without changing the recording', () => {
  const run = recordedRun();
  const original = JSON.stringify(run);
  for (const locale of ['en', 'ja', 'ko', 'zh'] as const) {
    const caption = demoPresentation(run, locale, 'recording');
    assert.ok(Array.from(caption.title).length <= 96);
    assert.ok(Array.from(caption.summary).length <= 160);
    assert.ok(!caption.title.includes('Public demonstration scenario:'));
  }
  assert.equal(JSON.stringify(run), original);
  assert.equal(cardExcerpt('A short complete question?', 96), 'A short complete question?');
  const excerpt = cardExcerpt(
    'A long question containing several complete words and additional context',
    32,
  );
  assert.ok(excerpt.length <= 32);
  assert.equal(excerpt, 'A long question containing…');
});
