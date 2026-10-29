import { test, expect } from '@playwright/test';
import { fixtureIds } from '../fixtures/scenarios.ts';
test.beforeEach(async ({ page, request }) => {
  const guard = await (await request.get('/test-isolation')).json();
  expect(guard.testOnly).toBe(true);
  expect(guard.realCli).toBe(false);
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
});

test('answer and voting result are on the main screen, survive reload, and appear only at the recorded completion', async ({
  page,
}, info) => {
  await page.goto(`/?run=${fixtureIds.approved}`);
  await expect(page.getByTestId('final-report')).toContainText('2 / 3');
  await expect(page.getByTestId('answer-text')).toContainText('APPROVED');
  await expect(page.getByTestId('final-answer')).toContainText('조건과 다음 단계');
  await page.getByTestId('jump-answer').click();
  await expect(page.getByTestId('final-report')).toBeInViewport();
  await expect(page.getByTestId('answer-text')).toBeInViewport();
  await page.reload();
  await expect(page.getByTestId('answer-text')).toBeVisible();
  await page.screenshot({
    path: `docs/evidence/${info.project.name}-final-answer.png`,
    fullPage: true,
  });
  await page.getByTestId('replay-start').click();
  const controls = page.getByTestId('replay-controls');
  await controls.locator('button').first().click();
  await controls.getByRole('slider').press('Home');
  await expect(page.getByTestId('final-answer')).toHaveCount(0);
  await controls.getByRole('slider').press('End');
  await expect(page.getByTestId('answer-text')).toContainText('APPROVED');
});

test('legacy generation uses one report request, persists it and never starts a new decision', async ({
  page,
  request,
}) => {
  await request.post('/test-reset/legacy');
  await page.goto(`/?run=${fixtureIds.legacy}`);
  await expect(page.getByTestId('generate-answer')).toBeVisible();
  await expect(page.getByTestId('phase-waiting')).toContainText('종합 보고서가 저장돼 있지 않다');
  const before = await (await request.get(`/api/runs/${fixtureIds.legacy}`)).json();
  await page.getByTestId('generate-answer').click();
  await expect(page.getByTestId('answer-text')).toBeVisible();
  const after = await (await request.get(`/api/runs/${fixtureIds.legacy}`)).json();
  expect(after.records).toEqual(before.records);
  expect(after.verdict).toEqual(before.verdict);
  const again = await request.post(`/api/runs/${fixtureIds.legacy}/answer`);
  expect(again.status()).toBe(200);
  expect((await again.json()).version).toBe(after.version);
  await page.reload();
  await expect(page.getByTestId('answer-text')).toBeVisible();
});

test('report failure preserves votes, exposes retry, and cancellation stops only the report', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(page.locator('.link-status')).toContainText('정상');
  await page.locator('.new-button').click();
  await page.locator('#proposal').fill('[TEST REPORT_ERROR] synthesize without changing votes');
  await page.locator('.proposal-console button[type=submit]').click();
  await expect(page.getByTestId('final-answer')).toContainText('Test-only synthesis failure', {
    timeout: 15000,
  });
  await expect(page.getByTestId('final-report')).toContainText('APPROVED');
  await expect(page.getByTestId('generate-answer')).toContainText('다시 생성');
  await expect(page.getByTestId('phase-waiting')).toContainText('최종 보고서 작성에 실패');
  await page.locator('.new-button').click();
  await page.locator('#proposal').fill('[TEST REPORT_SLOW] cancel synthesis only');
  await page.locator('.proposal-console button[type=submit]').click();
  await expect(page.locator('.answer-pending')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('final-report')).toContainText('APPROVED');
  await page.locator('.abort-button').click();
  await expect(page.getByTestId('final-answer')).toContainText('답변 작성을 중지');
  await expect(page.getByTestId('phase-waiting')).toContainText('최종 보고서 작성을 중지');
  await expect(page.getByTestId('final-report')).toContainText('APPROVED');
});

test('static diagnostic panels never move while live time and processing continue', async ({
  page,
  request,
}) => {
  const run = await (
    await request.post('/api/runs', { data: { question: '[TEST SLOW] fixed panels' } })
  ).json();
  try {
    await page.goto(`/?run=${run.id}`);
    await expect(page.locator('.diagnostic-rotor')).toHaveCount(3);
    const transforms = await page
      .locator('.diagnostic-rotor')
      .evaluateAll((items) => items.map((item) => item.getAttribute('transform')));
    const time = await page.locator('.magi-screen').getAttribute('data-motion-time');
    await page.waitForTimeout(300);
    expect(
      await page
        .locator('.diagnostic-rotor')
        .evaluateAll((items) => items.map((item) => item.getAttribute('transform'))),
    ).toEqual(transforms);
    expect(await page.locator('.magi-screen').getAttribute('data-motion-time')).not.toEqual(time);
  } finally {
    await request.post(`/api/runs/${run.id}/cancel`);
  }
});

test('the MAGI system remains the dominant front display when a final answer is present', async ({
  page,
}) => {
  await page.goto(`/?run=${fixtureIds.approved}`);
  for (const [width, height] of [
    [1440, 1100],
    [883, 645],
    [390, 844],
  ]) {
    await page.setViewportSize({ width, height });
    const display = await page.locator('.magi-display').boundingBox();
    expect(display).not.toBeNull();
    expect(display!.width / display!.height).toBeCloseTo(4 / 3, 3);
    expect(display!.width).toBeGreaterThan(Math.min(width - 50, ((height - 180) * 4) / 3));
  }
});
