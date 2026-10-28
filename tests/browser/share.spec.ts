import { test, expect } from '@playwright/test';
import { fixtureIds } from '../fixtures/scenarios.ts';
test('local final answers export a reviewed image without uploading the private question', async ({
  page,
}) => {
  const uploads: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') uploads.push(request.url());
  });
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
  await page.goto(`/?run=${fixtureIds.approved}`);
  await page.getByTestId('share-verdict').click();
  await expect(page.getByTestId('share-preview')).toBeVisible();
  await page.getByTestId('share-include-question').uncheck();
  await expect(page.getByTestId('share-preview')).toBeVisible();
  const event = page.waitForEvent('download');
  await page.getByTestId('download-share').click();
  expect((await event).suggestedFilename()).toBe('MAGI-approved.png');
  await expect(page.getByRole('dialog').locator('a')).toHaveAttribute(
    'href',
    'https://jhyeong687.github.io/MAGI/',
  );
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(uploads).toEqual([]);
});
