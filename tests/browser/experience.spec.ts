import { test, expect } from '@playwright/test';
import { fixtureIds } from '../fixtures/scenarios.ts';

test.beforeEach(async ({ page, request }) => {
  const guard = await (await request.get('/test-isolation')).json();
  expect(guard.testOnly && guard.realCli === false).toBe(true);
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
});

test('question helper saves edits, preserves the main draft, respects its limit and never starts a deliberation', async ({
  page,
}) => {
  let submitted = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/runs')) submitted++;
  });
  await page.goto('/');
  await page.locator('.new-button').click();
  await page.locator('#proposal').fill('내가 적은 원래 질문');
  await page.getByTestId('guide-project').click();
  await page.getByTestId('guide-criteria').fill('수면 8시간과 검증 시간을 확보해야 한다.');
  await expect(page.getByTestId('guide-criteria')).toHaveValue(
    '수면 8시간과 검증 시간을 확보해야 한다.',
  );
  await expect(page.locator('#proposal')).toHaveValue('내가 적은 원래 질문');
  await page.reload();
  await expect(page.getByTestId('guide-criteria')).toHaveValue(
    '수면 8시간과 검증 시간을 확보해야 한다.',
  );
  await page.getByTestId('guide-apply').click();
  await expect(page.locator('#proposal')).toBeFocused();
  const composed = await page.locator('#proposal').inputValue();
  expect(composed).toContain('내가 적은 원래 질문');
  expect(composed).toContain('수면 8시간과 검증 시간을 확보해야 한다.');
  await page.getByTestId('guide-apply').click();
  await expect(page.locator('#proposal')).toHaveValue(composed);
  await page.locator('#proposal').fill('가'.repeat(5999));
  await page.getByTestId('guide-apply').click();
  await expect(page.getByTestId('question-guide')).toContainText('6,000');
  await expect(page.locator('#proposal')).toHaveValue('가'.repeat(5999));
  await page.locator('#proposal').fill('길이를 줄인 질문');
  await page.getByTestId('guide-apply').click();
  await expect(page.locator('#proposal')).toHaveValue(/길이를 줄인 질문/);
  await expect(page.getByTestId('question-guide').getByRole('status')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  expect(submitted).toBe(0);
});

test('old answers show a brief first, keep full evidence collapsed and never regenerate to change the presentation', async ({
  page,
  request,
}) => {
  const original = await (await request.get(`/api/runs/${fixtureIds.approved}`)).json();
  let generated = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST') generated++;
  });
  await page.goto(`/?run=${fixtureIds.approved}`);
  await expect(page.getByTestId('answer-text')).toHaveText('테스트 전용 종합 답변: APPROVED.');
  await expect(page.getByTestId('answer-next-steps')).toContainText('검증용 실행 조건');
  await expect(page.getByTestId('answer-key-objection')).toContainText('BALTHASAR-2');
  await expect(page.getByTestId('answer-original')).toBeHidden();
  await page.getByTestId('answer-details').locator('summary').click();
  await expect(page.getByTestId('answer-original')).toHaveText(original.answer.content.answer);
  await expect(page.getByTestId('answer-original')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  const after = await (await request.get(`/api/runs/${fixtureIds.approved}`)).json();
  expect(after.answer).toEqual(original.answer);
  expect(after.verdict).toEqual(original.verdict);
  expect(generated).toBe(0);
});

test('waiting status follows actual per-stage responses and replay time without future names or invented progress', async ({
  page,
}) => {
  await page.goto(`/?run=${fixtureIds.approved}`);
  await page.getByTestId('replay-start').click();
  const controls = page.getByTestId('replay-controls');
  await controls.locator('button').first().click();
  const seek = async (value: number) =>
    controls.getByRole('slider').evaluate((input: HTMLInputElement, position) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        String(position),
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  await seek(650);
  await expect(page.getByTestId('phase-response-count')).toHaveText('2 / 3');
  await expect(page.getByTestId('phase-waiting')).toHaveText('응답 대기: CASPER-3');
  await expect(page.getByTestId('deliberation-status')).toContainText('기록 시점');
  await seek(1100);
  await expect(page.getByTestId('phase-response-count')).toHaveText('0 / 3');
  await expect(page.getByTestId('phase-waiting')).toContainText(
    'MELCHIOR-1 · BALTHASAR-2 · CASPER-3',
  );
  await expect(page.getByTestId('answer-brief')).toHaveCount(0);
  await expect(page.locator('.screen-kanji text')).toHaveText(['提訴', '決議']);
});

test('live waiting shows elapsed time and actual response arrival, then stops its waiting message on cancellation', async ({
  page,
  request,
}) => {
  const run = await (
    await request.post('/api/runs', {
      data: { question: '[TEST SLOW] status monitor, isolated runner only' },
    })
  ).json();
  try {
    await page.goto(`/?run=${run.id}`);
    await expect(page.getByTestId('phase-response-count')).toHaveText('0 / 3');
    await expect(page.getByTestId('deliberation-status')).toContainText('첫 실제 응답');
    await expect(page.getByTestId('deliberation-status')).toContainText('경과');
    const initial = await page.getByTestId('status-elapsed').textContent();
    await expect(page.getByTestId('status-elapsed')).not.toHaveText(initial!, { timeout: 3000 });
    await expect(page.getByTestId('deliberation-status')).toContainText('마지막 응답', {
      timeout: 3000,
    });
    await request.post(`/api/runs/${run.id}/cancel`);
    await expect(page.getByTestId('phase-waiting')).toContainText('중지');
    await expect(page.getByTestId('phase-waiting')).not.toContainText('응답 대기');
  } finally {
    await request.post(`/api/runs/${run.id}/cancel`);
  }
});
