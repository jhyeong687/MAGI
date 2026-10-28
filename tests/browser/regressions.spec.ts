import { test, expect } from '@playwright/test';
import { fixtureIds } from '../fixtures/scenarios.ts';

test.beforeEach(async ({ page, request }) => {
  const guard = await (await request.get('/test-isolation')).json();
  expect(guard.testOnly).toBe(true);
  expect(guard.realCli).toBe(false);
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
});
async function pauseAtStart(page: import('@playwright/test').Page) {
  await page.getByTestId('replay-start').click();
  const controls = page.getByTestId('replay-controls');
  await controls.locator('button').first().click();
  await controls.getByRole('slider').press('Home');
}
test('replay time, usage, errors and session IDs contain only information available at that moment', async ({
  page,
}) => {
  await page.goto(`/?run=${fixtureIds.error}`);
  await expect(page.getByTestId('resolution-stamp')).toContainText('障害');
  await pauseAtStart(page);
  await page.getByTestId('open-transcript').click();
  await expect(page.locator('.transcript-meta')).toContainText('0 개 기록');
  await expect(page.locator('.transcript-footer')).toContainText('0s · 0 TOKENS');
  await page.keyboard.press('Escape');
  await page.getByTestId('core-melchior').click();
  await expect(page.locator('.error-text')).toHaveCount(0);
  await expect(page.locator('.thread-id')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.getByTestId('replay-controls').getByRole('slider').press('End');
  await page.getByTestId('core-melchior').click();
  await expect(page.locator('.error-text')).toContainText('TERMINAL melchior ERROR');
});
test('Escape closes the top dialog while preserving cinema; a second Escape exits cinema', async ({
  page,
}) => {
  await page.goto(`/?run=${fixtureIds.approved}&cinema=1`);
  await expect(page.locator('.app-shell')).toHaveClass(/cinema-mode/);
  await page.getByTestId('core-melchior').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.locator('.app-shell')).toHaveClass(/cinema-mode/);
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-shell')).not.toHaveClass(/cinema-mode/);
  await expect(page).not.toHaveURL(/cinema=1/);
});
test('another tab follows a new live decision, completion and cancellation without refresh', async ({
  page,
  context,
  request,
}) => {
  await page.goto('/?cinema=1');
  await expect(page.locator('.magi-display')).toBeVisible();
  const created = await request.post('/api/runs', {
    data: { question: '[TEST SLOW] multi-tab synchronization' },
  });
  expect(created.status()).toBe(201);
  const run = await created.json();
  try {
    await expect(page).toHaveURL(new RegExp(`run=${run.id}`));
    await expect(page.locator('.app-shell')).toHaveClass(/cinema-mode/);
    await expect(page).toHaveURL(/cinema=1/);
    await expect(page.getByTestId('resolution-stamp')).toContainText('審議中');
    await request.post(`/api/runs/${run.id}/cancel`);
    await expect(page.getByTestId('resolution-stamp')).toContainText('中止');
  } finally {
    await request.post(`/api/runs/${run.id}/cancel`);
  }
});
test('a pinned historical decision stays selected but receives an active decision notification', async ({
  page,
  request,
}) => {
  await page.goto(`/?run=${fixtureIds.approved}`);
  await expect(page.getByTestId('resolution-stamp')).toContainText('可決');
  const run = await (
    await request.post('/api/runs', {
      data: { question: '[TEST SLOW] pinned history notification' },
    })
  ).json();
  try {
    await expect(page.locator('.active-link')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(fixtureIds.approved));
    await page.locator('.active-link').click();
    await expect(page).toHaveURL(new RegExp(run.id));
    await expect(page.getByTestId('resolution-stamp')).toContainText('審議中');
    await request.post(`/api/runs/${run.id}/cancel`);
    await expect(page.getByTestId('resolution-stamp')).toContainText('中止');
  } finally {
    await request.post(`/api/runs/${run.id}/cancel`);
  }
});
for (const [tag, result, stamp] of [
  ['DENIED', 'DENIED', '否決'],
  ['ABSTAIN', 'INCONCLUSIVE', '保留'],
  ['ERROR', 'error', '障害'],
] as const) {
  test(`isolated ${tag} goes through the real orchestration and UI`, async ({ page, request }) => {
    await page.goto('/');
    await expect(page.locator('.link-status')).toContainText('정상');
    await page.locator('.new-button').click();
    await page.locator('#proposal').fill(`[TEST ${tag}] full error/voting path`);
    await page.locator('.proposal-console button[type=submit]').click();
    await expect(page.getByTestId('resolution-stamp')).toContainText(stamp, { timeout: 15000 });
    if (result === 'error')
      await expect(page.locator('.status-banner.failed')).toContainText('Test-only Codex failure');
    else await expect(page.getByTestId('final-report')).toContainText(result);
  });
}

test('reconnection refreshes a pinned decision completed offline even when a newer run exists', async ({
  page,
  context,
  request,
}) => {
  const first = await (
    await request.post('/api/runs', { data: { question: '[TEST SLOW] offline original' } })
  ).json();
  await page.goto(`/?run=${first.id}`);
  await expect(page.getByTestId('resolution-stamp')).toContainText('審議中');
  let second: { id: string } | undefined;
  try {
    await context.setOffline(true);
    await request.post(`/api/runs/${first.id}/cancel`);
    second = await (
      await request.post('/api/runs', { data: { question: '[TEST SLOW] newer while offline' } })
    ).json();
    await context.setOffline(false);
    await expect(page.getByTestId('resolution-stamp')).toContainText('中止', { timeout: 12000 });
    await expect(page).toHaveURL(new RegExp(first.id));
  } finally {
    await context.setOffline(false);
    await request.post(`/api/runs/${first.id}/cancel`);
    if (second) await request.post(`/api/runs/${second.id}/cancel`);
  }
});
