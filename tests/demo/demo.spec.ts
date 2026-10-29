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
  await expect(page.getByTestId('demo-disclosure')).toContainText('実際');
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
  for (const [id, result, color, counts] of [
    ['club', 'APPROVED', 'rgb(83, 243, 156)', '2 APPROVE / 1 DENY / 0 ABSTAIN'],
    ['feature', 'DENIED', 'rgb(243, 119, 105)', '1 APPROVE / 2 DENY / 0 ABSTAIN'],
    ['meeting', 'INCONCLUSIVE', 'rgb(237, 182, 83)', '1 APPROVE / 1 DENY / 1 ABSTAIN'],
  ]) {
    await page.getByTestId(`example-${id}`).click();
    await expect(page.getByTestId('demo-result')).toHaveCount(0);
    await expect(page.getByTestId('demo-opinion')).toContainText('Awaiting');
    await page.getByTestId('demo-start').click();
    await page.getByTestId('demo-play').click();
    const slider = page.getByTestId('demo-seek');
    await slider.press('Home');
    await expect(page.getByTestId('core-melchior')).toHaveAttribute('data-state', 'ANALYZING');
    await expect(page.locator('.diagnostic-ring')).toHaveCount(1);
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
      await expect(page.locator('.magi-display circle')).toHaveCount(0);
      await expect(page.locator('.screen-connections path')).toHaveCount(1);
      await expect(page.getByTestId('demo-result')).toHaveCount(0);
      if (phase === 'cross-examination') {
        await page.getByTestId('core-casper').click();
        await expect(page.getByTestId('demo-inspector')).toBeFocused();
        await expect(page.getByTestId('demo-opinion')).toBeInViewport();
        await expect(page.getByTestId('demo-opinion')).not.toContainText('Awaiting');
        await expect(page.locator('#demo-opinion-title')).toHaveText('CASPER-3');
      }
    }
    await slider.press('End');
    await expect(page.getByTestId('answer-text')).toBeVisible();
    await expect(page.getByTestId('demo-result')).toContainText(result);
    await expect(page.getByTestId('demo-result')).toHaveCSS('color', color);
    await expect(page.getByTestId('demo-vote-counts')).toHaveText(counts);
    if (result !== 'INCONCLUSIVE')
      await expect(page.getByTestId('demo-result').locator('em')).toHaveCount(0);
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
  expect(file.suggestedFilename()).toBe('MAGI-denied.png');
  const bytes = await readFile((await file.path())!);
  expect(bytes.subarray(1, 4).toString()).toBe('PNG');
  expect(bytes.readUInt32BE(16)).toBe(1200);
  expect(bytes.readUInt32BE(20)).toBe(1600);
  expect(bytes.length).toBeGreaterThan(20_000);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(uploads).toEqual([]);
});

test('featured real session has a visible labelled start, keeps 4:3 Japanese artwork and reveals a focused answer', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.getByTestId('example-recording')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('demo-start')).toBeInViewport();
  await expect(page.getByTestId('demo-start')).toContainText('22');
  await expect(page.getByRole('combobox', { name: '再生速度' })).toHaveValue('4');
  expect(
    await page.getByTestId('demo-start').evaluate((el) => el.getBoundingClientRect().height),
  ).toBeGreaterThanOrEqual(44);
  const ratio = await page.locator('.magi-display').evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.width / box.height;
  });
  expect(ratio).toBeCloseTo(4 / 3, 1);
  await page.getByTestId('demo-start').click();
  await page.getByTestId('demo-finish').click();
  await expect(page.getByTestId('demo-answer-target')).toBeFocused();
  await expect(page.getByTestId('answer-text')).toBeInViewport();
  await expect(page.locator('.decision-reveal')).toHaveCount(0);
  await expect(page.getByTestId('resolution-stamp')).toHaveText('否決');
  for (let repeat = 0; repeat < 3; repeat++) {
    await page.getByTestId('demo-finish').click();
    await expect(page.getByTestId('demo-answer-target')).toBeFocused();
    await expect(page.getByTestId('answer-text')).toBeInViewport();
  }
});

test('public verdict links reopen the same localized result and editable captions do not rewrite the report', async ({
  page,
}) => {
  await page.goto('./?lang=ko&example=recording&view=result');
  await expect(page.getByTestId('demo-answer-target')).toBeFocused();
  await expect(page.getByTestId('locale-select')).toHaveValue('ko');
  await expect(page.getByTestId('demo-result')).toContainText('DENIED');
  const answer = await page.getByTestId('answer-text').textContent();
  await page.getByTestId('share-verdict').click();
  await expect(page.getByTestId('share-headline')).toHaveValue(
    '시연까지 이틀. 새 기능을 하나 더 넣어도 될까?',
  );
  await expect(page.getByRole('dialog').locator('a')).toHaveAttribute(
    'href',
    'https://jhyeong687.github.io/MAGI/?lang=ko&example=recording&view=result',
  );
  const previous = await page.getByTestId('share-preview').getAttribute('src');
  await page.getByTestId('share-headline').fill('내가 공유할 짧은 제목');
  await expect(page.getByTestId('share-preview')).not.toHaveAttribute('src', previous!);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('answer-text')).toHaveText(answer!);
});

test('reduced motion also hands the shared result to the answer without a reveal overlay', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./?lang=en&example=club&view=result');
  await expect(page.getByTestId('demo-answer-target')).toBeFocused();
  await expect(page.getByTestId('demo-result')).toContainText('APPROVED');
  await expect(page.locator('.decision-reveal')).toHaveCount(0);
});

test('a real session finishes naturally at the advertised fast speed and hands focus to its answer', async ({
  page,
}) => {
  await page.goto('./?lang=en&example=recording');
  await page.getByTestId('demo-start').click();
  await expect(page.getByTestId('demo-result')).toHaveCount(0);
  await expect(page.getByTestId('demo-answer-target')).toBeFocused({ timeout: 28_000 });
  await expect(page.getByTestId('demo-result')).toContainText('DENIED');
  await expect(page.locator('.demo-transcript summary')).toContainText('12 / 12');
  await expect(page.getByTestId('answer-text')).toBeInViewport();
});

test('unsupported locale values fall back safely to Japanese', async ({ page }) => {
  await page.goto('./?lang=toString&example=recording');
  await expect(page.getByTestId('locale-select')).toHaveValue('ja');
  await expect(page.getByTestId('demo-start')).toBeVisible();
});

test('effects preferences persist and system reduced motion can interrupt a reveal without losing the answer', async ({
  page,
}) => {
  await page.goto('./?lang=en&example=club');
  const effects = page.getByTestId('demo-effects');
  await expect(effects).toHaveAttribute('aria-pressed', 'true');
  await effects.click();
  await expect(page.locator('.demo-shell')).toHaveClass(/motion-off/);
  await page.reload();
  await expect(effects).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('demo-start').click();
  await expect(page.getByTestId('demo-play')).toHaveText('Ⅱ Pause');
  await expect(page.locator('.magi-screen')).toHaveAttribute('data-motion-time', '0');
  await page.getByTestId('demo-finish').click();
  await expect(page.getByTestId('demo-answer-target')).toBeFocused();
  await expect(page.locator('.decision-reveal')).toHaveCount(0);
  await effects.click();
  await page.getByTestId('demo-start').click();
  await page.getByTestId('demo-finish').click();
  await expect(page.locator('.decision-reveal')).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(effects).toBeDisabled();
  await expect(effects).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.decision-reveal')).toHaveCount(0);
  await expect(page.getByTestId('demo-answer-target')).toBeFocused();
  await expect(page.getByTestId('answer-text')).toBeInViewport();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(effects).toBeEnabled();
  await expect(effects).toHaveAttribute('aria-pressed', 'true');
});

test('public question helper drafts and copies privately without changing the recording or starting AI', async ({
  page,
  context,
}) => {
  const mutations: string[] = [];
  page.on('request', (request) => {
    if (!['GET', 'HEAD'].includes(request.method())) mutations.push(request.url());
  });
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('./?lang=ko&example=recording');
  const headline = await page.locator('#demo-question-title').textContent();
  await page.getByTestId('guide-career').click();
  await page.getByTestId('guide-decision').fill('PRIVATE_GUIDE_ONLY 내 선택');
  await page.reload();
  await expect(page.getByTestId('guide-decision')).toHaveValue('PRIVATE_GUIDE_ONLY 내 선택');
  await expect(page.getByTestId('guide-disclosure')).toContainText('AI를 호출하지 않는다');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.getByTestId('guide-apply').click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toContain('PRIVATE_GUIDE_ONLY');
  await expect(page.locator('#demo-question-title')).toHaveText(headline!);
  await expect(page.getByTestId('demo-result')).toHaveCount(0);
  expect(page.url()).not.toContain('PRIVATE_GUIDE_ONLY');
  await page.getByTestId('demo-start').click();
  await page.getByTestId('demo-finish').click();
  await expect(page.getByTestId('answer-text')).toContainText('Denied by a 2–1 vote');
  await expect(page.getByTestId('answer-text')).not.toContainText('PRIVATE_GUIDE_ONLY');
  expect(mutations).toEqual([]);
});

test('public stage status shows received opinions, report writing and a brief with expandable original evidence', async ({
  page,
}) => {
  await page.goto('./?lang=en&example=club');
  await page.getByTestId('demo-start').click();
  await page.getByTestId('demo-play').click();
  const seek = async (value: number) =>
    page.getByTestId('demo-seek').evaluate((input: HTMLInputElement, position) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        String(position),
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  await seek(2000);
  await expect(page.getByTestId('phase-response-count')).toHaveText('2 / 3');
  await expect(page.getByTestId('phase-waiting')).toHaveText('AWAITING RESPONSE: CASPER-3');
  await expect(page.getByTestId('deliberation-status')).toContainText('RECORDING POSITION');
  await seek(4500);
  await expect(page.getByTestId('phase-response-count')).toHaveText('0 / 3');
  await seek(16500);
  await expect(page.getByTestId('phase-response-count')).toHaveText('3 / 3');
  await expect(page.getByTestId('deliberation-status')).toContainText('FINAL VOTES RECEIVED');
  await expect(page.getByTestId('phase-waiting')).toContainText('Synthesizing');
  await expect(page.locator('.answer-pending')).toBeVisible();
  await expect(page.getByTestId('answer-brief')).toHaveCount(0);
  await page.getByTestId('demo-finish').click();
  await expect(page.getByTestId('demo-answer-target')).toBeFocused();
  await expect(page.getByTestId('answer-text')).toBeInViewport();
  expect(await page.getByTestId('answer-next-steps').locator('li').count()).toBeLessThanOrEqual(3);
  await expect(page.getByTestId('answer-key-objection')).not.toBeEmpty();
  await expect(page.getByTestId('answer-original')).toBeHidden();
  await page.getByTestId('answer-details').locator('summary').click();
  await expect(page.getByTestId('answer-original')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.locator('.screen-kanji text')).toHaveText(['提訴', '決議']);
});
