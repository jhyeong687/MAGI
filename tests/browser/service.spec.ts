import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fixtureIds } from '../fixtures/scenarios.ts';

test.beforeEach(async ({ page, request }) => {
  const isolation = await (await request.get('/test-isolation')).json();
  expect(isolation.testOnly).toBe(true);
  expect(isolation.realCli).toBe(false);
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
});

test('new proposal stays blank after unrelated catalog updates and drafts survive navigation and reload', async ({
  page,
  request,
}) => {
  await page.goto(`/?run=${fixtureIds.approved}`);
  await expect(page.getByTestId('answer-text')).toBeVisible();
  await expect(page.getByRole('img', { name: 'NERV', exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.nerv-mark img')
        .evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    )
    .toBe(true);
  await page.locator('.new-button').click();
  await page.locator('#proposal').fill('보관해 둘 질문 초안');
  const settings = await (await request.get('/api/settings')).json();
  await request.put('/api/settings', { data: settings });
  await expect(page.getByTestId('final-report')).toHaveCount(0);
  await expect(page).not.toHaveURL(/run=/);
  await expect(page.locator('#proposal')).toHaveValue('보관해 둘 질문 초안');
  await page.reload();
  await expect(page.locator('#proposal')).toHaveValue('보관해 둘 질문 초안');
  await page.locator('.new-button').click();
  await expect(page.locator('#proposal')).toHaveValue('보관해 둘 질문 초안');
  await page.getByRole('button', { name: '초안 지우기', exact: true }).click();
  await expect(page.locator('#proposal')).toHaveValue('');
  await page.getByRole('button', { name: '예시 질문 불러오기', exact: true }).click();
  await expect(page.locator('#proposal')).toHaveValue(/동아리/);
});

test('archive search finds the right decision and has an explicit empty state', async ({
  page,
}) => {
  await page.goto(`/?run=${fixtureIds.approved}`);
  await page.getByTestId('open-history').click();
  const dialog = page.getByRole('dialog', { name: /판정 기록/ });
  const search = dialog.getByRole('searchbox');
  await search.fill('NO_MATCH_question_239');
  await expect(dialog.locator('.archive-list button')).toHaveCount(0);
  await expect(dialog).toContainText('일치하는 판정 기록이 없습니다.');
  await search.fill('APPROVED');
  await expect(dialog.locator('.archive-list button').first()).toBeVisible();
  await search.fill('');
  await expect(dialog.locator('.archive-list button').count()).resolves.toBeGreaterThan(1);
});

test('report download contains the actual answer, voting result and minority opinion with no new run', async ({
  page,
  request,
}) => {
  await page.goto(`/?run=${fixtureIds.approved}`);
  const before = await (await request.get('/api/runs')).json();
  const download = page.waitForEvent('download');
  await page.getByTestId('download-report').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^MAGI-.+\.md$/);
  const contents = await readFile((await file.path())!, 'utf8');
  expect(contents).toContain('APPROVED · 2 / 3');
  expect(contents).toContain('BALTHASAR-2 · DENY');
  expect(contents).toContain(await page.getByTestId('answer-text').innerText());
  expect((await (await request.get('/api/runs')).json()).length).toBe(before.length);
});

test('disconnected live channel blocks both button and keyboard submission without losing the draft', async ({
  page,
}) => {
  await page.route('**/api/events', (route) => route.abort());
  let submitted = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().endsWith('/api/runs')) submitted++;
  });
  await page.goto(`/?run=${fixtureIds.approved}`);
  await page.locator('.new-button').click();
  await page.locator('#proposal').fill('연결 복구 후 실행할 질문');
  await expect(page.locator('.connection-warning')).toBeVisible();
  await expect(page.locator('.proposal-console button[type=submit]')).toBeDisabled();
  await page.locator('#proposal').press('Control+Enter');
  expect(submitted).toBe(0);
  await expect(page.locator('#proposal')).toHaveValue('연결 복구 후 실행할 질문');
});

test('explicit voice refresh updates only the report and preserves the previous answer and every vote', async ({
  page,
  request,
}) => {
  await request.post('/test-reset/approved');
  await page.goto(`/?run=${fixtureIds.approved}`);
  const before = await (await request.get(`/api/runs/${fixtureIds.approved}`)).json();
  await page.getByTestId('refresh-answer').click();
  await expect(page.getByTestId('refresh-answer')).toHaveCount(0);
  await expect(page.getByTestId('answer-text')).toBeVisible();
  const after = await (await request.get(`/api/runs/${fixtureIds.approved}`)).json();
  expect(after.answer.revision).toBe('command-voice-v1');
  expect(after.answer.previousContent).toEqual(before.answer.content);
  expect(after.verdict).toEqual(before.verdict);
  expect(after.records).toEqual(before.records);
  expect(after.cores).toEqual(before.cores);
  expect(
    (
      await request.post(`/api/runs/${fixtureIds.approved}/answer`, { data: { refresh: true } })
    ).status(),
  ).toBe(200);
});
