import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('the published video player loads the 25-second MP4 and the portrait download exists', async ({
  page,
  request,
}) => {
  await page.goto('./?lang=en');
  const video = page.locator('.demo-video video');
  await expect(video).toHaveAttribute('controls', '');
  await video.evaluate((element: HTMLVideoElement) => element.load());
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.duration)).toBe(25);
  const portrait = await request.get('./magi-demo-vertical.mp4');
  expect(portrait.ok()).toBe(true);
  expect(portrait.headers()['content-type']).toContain('video/mp4');
  expect((await portrait.body()).length).toBeGreaterThan(100_000);
});

test('the actual public recording retains its real votes and original English opinions', async ({
  page,
}) => {
  await page.goto('./?lang=ja&example=recording');
  await expect(page.getByTestId('demo-disclosure')).toContainText('実際');
  await page.getByTestId('demo-start').click();
  await page.getByTestId('demo-finish').click();
  await expect(page.getByTestId('demo-result')).toContainText('DENIED');
  await expect(page.getByTestId('core-melchior')).toHaveAttribute('data-state', 'APPROVE');
  await expect(page.getByTestId('core-balthasar')).toHaveAttribute('data-state', 'DENY');
  await expect(page.getByTestId('core-casper')).toHaveAttribute('data-state', 'DENY');
  await expect(page.getByTestId('answer-text')).toContainText('Denied by a 2–1 vote');
  await expect(page.getByTestId('resolution-stamp')).toHaveText('否決');
});

test('static demo defaults to Japanese, never calls a backend and keeps Japanese artwork in four UI languages', async ({
  page,
}) => {
  const backend: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (/\/api\//.test(request.url())) backend.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('./');
  await expect(page.getByTestId('locale-select')).toHaveValue('ja');
  await expect(page.getByTestId('demo-disclosure')).toContainText('実時間AI');
  for (const locale of ['en', 'ko', 'zh', 'ja']) {
    await page.getByTestId('locale-select').selectOption(locale);
    await expect(page.locator('.screen-kanji text')).toHaveText(['提訴', '決議']);
    await expect(page.getByTestId('resolution-stamp')).toHaveText('待機');
    await page.reload();
    await expect(page.getByTestId('locale-select')).toHaveValue(locale);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  expect(backend).toEqual([]);
  expect(errors).toEqual([]);
});

test('examples replay each phase without future opinions and produce approve, deny and no-majority results', async ({
  page,
}) => {
  await page.goto('./?lang=en');
  for (const [id, result] of [
    ['club', 'APPROVED'],
    ['feature', 'DENIED'],
    ['meeting', 'INCONCLUSIVE'],
  ]) {
    await page.getByTestId(`example-${id}`).click();
    await expect(page.getByTestId('demo-result')).toHaveCount(0);
    await expect(page.getByTestId('demo-opinion')).toContainText('Awaiting');
    await page.getByTestId('demo-start').click();
    await page.getByTestId('demo-play').click();
    const slider = page.getByTestId('demo-seek');
    await slider.press('Home');
    await expect(page.getByTestId('core-melchior')).toHaveAttribute('data-state', 'ANALYZING');
    await expect(page.getByTestId('demo-result')).toHaveCount(0);
    for (const [offset, phase] of [
      [4500, 'cross-examination'],
      [8500, 'reconsideration'],
      [12500, 'final-vote'],
    ] as const) {
      await slider.evaluate((input: HTMLInputElement, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
          input,
          String(value),
        );
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }, offset);
      await expect(page.locator('.reference-plane')).toHaveAttribute('data-phase', phase);
      await expect(page.getByTestId('demo-result')).toHaveCount(0);
    }
    await slider.press('End');
    await expect(page.getByTestId('answer-text')).toBeVisible();
    await expect(page.getByTestId('demo-result')).toContainText(result);
    await expect(page.locator('.decision-reveal')).toHaveCount(0, { timeout: 4000 });
  }
});

test('share preview downloads a Japanese 1200×1600 PNG, can withhold content and sends no upload', async ({
  page,
}) => {
  const uploads: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) uploads.push(request.url());
  });
  await page.goto('./?lang=en');
  await page.getByTestId('demo-start').click();
  await page.getByTestId('demo-finish').click();
  await expect(page.locator('.decision-reveal')).toHaveCount(0, { timeout: 4000 });
  await page.getByTestId('share-verdict').click();
  await expect(page.getByTestId('share-preview')).toBeVisible();
  const original = await page.getByTestId('share-preview').getAttribute('src');
  await page.getByTestId('share-include-question').uncheck();
  await page.getByTestId('share-include-answer').uncheck();
  await expect(page.getByTestId('share-preview')).toBeVisible();
  await expect(page.getByTestId('share-preview')).not.toHaveAttribute('src', original!);
  const download = page.waitForEvent('download');
  await page.getByTestId('download-share').click();
  const file = await download;
  expect(file.suggestedFilename()).toBe('MAGI-approved.png');
  const bytes = await readFile((await file.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(1600);
  expect(bytes.length).toBeGreaterThan(20_000);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(uploads).toEqual([]);
});
