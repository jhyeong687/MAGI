import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page, request }) => {
  const isolation = await (await request.get('/test-isolation')).json();
  expect(isolation.testOnly).toBe(true);
  expect(isolation.realCli).toBe(false);
  expect(isolation.storage).toMatch(/^magi-isolated-browser-/);
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
});

test('isolated local environment, three cores, archive, accessible details and viewport fit', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.magi-display')).toBeVisible();
  await expect(page.locator('.link-status')).not.toContainText('확인 중', { timeout: 15_000 });
  for (const name of ['melchior', 'balthasar', 'casper'])
    await expect(page.getByTestId(`core-${name}`)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await page.getByTestId('core-melchior').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.getByTestId('open-history').click();
  await expect(page.locator('.archive-panel')).toBeVisible();
  await page.getByRole('dialog').locator('.icon-button').click();
  await page.screenshot({
    path: `docs/evidence/${testInfo.project.name}-interface.png`,
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
});

test('configuration persists locale, animations, cycles and prompts, then restores original settings', async ({
  page,
  request,
}) => {
  const original = await (await request.get('/api/settings')).json();
  try {
    await page.goto('/');
    await expect(page.locator('.link-status')).not.toContainText('확인 중', { timeout: 15_000 });
    await page.getByTestId('open-config').click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('select').nth(0).selectOption('2');
    await dialog.locator('select').nth(1).selectOption('ja');
    await dialog.locator('input[type=checkbox]').first().uncheck();
    await dialog
      .locator('textarea')
      .nth(0)
      .fill(original.prompts.melchior + '\nBrowser persistence verification.');
    await dialog.locator('button[type=submit]').click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByTestId('open-config')).toContainText('設定');
    await expect(page.locator('.app-shell')).toHaveClass(/motion-off/);
    await page.reload();
    await expect(page.getByTestId('open-config')).toContainText('設定');
    const saved = await (await request.get('/api/settings')).json();
    expect(saved.discussionRounds).toBe(2);
    expect(saved.locale).toBe('ja');
    expect(saved.animations).toBe(false);
    expect(saved.prompts.melchior).toContain('Browser persistence');
  } finally {
    await request.put('/api/settings', { data: original });
  }
});

test('boot sequence can be skipped without starting AI sessions', async ({ page, request }) => {
  const before = await (await request.get('/api/runs')).json();
  await page.addInitScript(() => {
    sessionStorage.removeItem('magi-booted');
    localStorage.setItem('magi-animation', 'on');
  });
  await page.goto('/');
  const boot = page.locator('.boot-screen');
  await expect(boot).toBeVisible();
  await boot.locator('button').click();
  await expect(boot).not.toBeVisible();
  const after = await (await request.get('/api/runs')).json();
  expect(after.length).toBe(before.length);
});

test('recorded processing hides future decisions and replays to the real final vote without model calls', async ({
  page,
  request,
}, testInfo) => {
  const runs = await (await request.get('/api/runs')).json();
  const source = runs.find((run: { status: string }) => run.status === 'completed');
  expect(source).toBeDefined();
  let submissions = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().endsWith('/api/runs')) submissions++;
  });
  await page.goto(`/?run=${source.id}`);
  await expect(page.getByTestId('final-report')).toBeVisible();
  await page.getByTestId('replay-start').click();
  const controls = page.getByTestId('replay-controls');
  await expect(controls).toBeVisible();
  await controls.locator('button').first().click();
  const position = controls.locator('input[type=range]');
  await position.focus();
  await position.press('Home');
  await expect(page.getByTestId('final-report')).not.toBeVisible();
  await expect(page.getByTestId('resolution-stamp')).toContainText('審議中');
  await expect(page.getByTestId('process-monitor')).toContainText('0 / 12');
  await page.screenshot({
    path: `docs/evidence/${testInfo.project.name}-anime-processing.png`,
    fullPage: true,
    animations: 'disabled',
  });
  await position.press('End');
  await expect(page.getByTestId('final-report')).toContainText(source.result);
  await expect(page.getByTestId('process-monitor')).toContainText('12 / 12');
  await expect(page.locator('.decision-reveal')).toBeVisible();
  await expect(page.locator('.decision-reveal')).toHaveCount(0, { timeout: 4000 });
  await page.screenshot({
    path: `docs/evidence/${testInfo.project.name}-anime-final.png`,
    fullPage: true,
    animations: 'disabled',
  });
  expect(submissions).toBe(0);
});

test('cinema mode shows only the original-style display and exits with Escape', async ({
  page,
}, testInfo) => {
  await page.goto('/');
  await expect(page.locator('.magi-display')).toBeVisible();
  await page.locator('.fullscreen-button').click();
  await expect(page.locator('.app-shell')).toHaveClass(/cinema-mode/);
  await expect(page.locator('.operator-console')).not.toBeVisible();
  await expect(page.locator('.operator-toolbar')).not.toBeVisible();
  await page.mouse.move(-5, -5);
  await page.screenshot({
    path: `docs/evidence/${testInfo.project.name}-anime-cinema.png`,
    animations: 'disabled',
  });
  await page.keyboard.press('Escape');
  await expect(page.locator('.app-shell')).not.toHaveClass(/cinema-mode/);
  await expect(page.locator('.operator-console')).toBeVisible();
});

test('TV frame and every internal element keep the same proportions at desktop, portrait and landscape sizes', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.magi-display')).toBeVisible();
  let reference: number[][] | undefined;
  for (const [width, height] of [
    [1920, 1080],
    [1440, 900],
    [1280, 720],
    [390, 844],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    const drawing = await page.locator('.magi-display').evaluate((svg) => {
      const element = svg as SVGSVGElement;
      const bounds = element.getBoundingClientRect();
      const matrix = element.querySelector<SVGGElement>('.reference-plane')!.getCTM()!;
      const shapes = [
        ...element.querySelectorAll(
          '.anime-core .core-body,.diagnostic-rotor polygon,.screen-stamp,.screen-kanji,.screen-magi',
        ),
      ].map((item) => {
        const box = item.getBoundingClientRect();
        return [
          (box.x - bounds.x) / bounds.width,
          (box.y - bounds.y) / bounds.height,
          box.width / bounds.width,
          box.height / bounds.height,
        ];
      });
      return {
        ratio: bounds.width / bounds.height,
        uniformScale: matrix.a / matrix.d,
        shapes,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    expect(drawing.ratio).toBeCloseTo(4 / 3, 2);
    expect(drawing.uniformScale).toBeCloseTo(10 / 11, 5);
    expect(drawing.overflow).toBe(false);
    if (reference)
      drawing.shapes.forEach((shape, index) =>
        shape.forEach((coordinate, axis) =>
          expect(coordinate).toBeCloseTo(reference![index][axis], 2),
        ),
      );
    reference = drawing.shapes;
  }
});
