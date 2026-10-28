import { test, expect } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fixtureIds } from '../fixtures/scenarios.ts';

test('reference capture landmarks, 4:3 display and replay motion remain consistent', async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
  await page.goto(`/?run=${fixtureIds.approved}`);
  await expect(page.getByTestId('final-report')).toBeVisible();
  await page.getByTestId('replay-start').click();
  const controls = page.getByTestId('replay-controls');
  await controls.locator('button').first().click();
  await controls.getByRole('slider').press('Home');
  await expect(page.locator('.magi-screen')).toHaveAttribute('data-motion-time', '0');
  const rotor = page.locator('.balthasar .diagnostic-rotor');
  const before = await rotor.getAttribute('transform');
  await page.waitForTimeout(200);
  expect(await rotor.getAttribute('transform')).toBe(before);
  await controls.getByRole('slider').press('ArrowRight');
  expect(await rotor.getAttribute('transform')).toBe(before);
  await controls.getByRole('slider').press('Home');
  await page.locator('.fullscreen-button').click();
  await page.mouse.move(-5, -5);
  const measure = () =>
    page.locator('.reference-plane').evaluate((plane) =>
      Object.fromEntries(
        [...plane.querySelectorAll('.anime-core')].map((core) => {
          const polygon = core.querySelector<SVGPolygonElement>(
            '.core-body, .diagnostic-rotor polygon',
          )!;
          const transform = (plane as SVGGElement).getCTM()!.inverse().multiply(polygon.getCTM()!);
          const points = [...polygon.points].map((p) => {
            const q = new DOMPoint(p.x, p.y).matrixTransform(transform);
            return [q.x, q.y];
          });
          return [(core.getAttribute('data-testid') || '').replace('core-', ''), points];
        }),
      ),
    );
  const diagnostics = await measure();
  await page
    .locator('.magi-display')
    .screenshot({ path: `docs/evidence/${testInfo.project.name}-reference-diagnostics.png` });
  await page.keyboard.press('Escape');
  await controls.getByRole('slider').press('End');
  await expect(page.locator('.decision-reveal')).toBeVisible();
  await expect(page.locator('.decision-reveal')).toHaveCount(0, { timeout: 4000 });
  // Empty canonical scene preserves the source frame's empty panel treatment.
  await page.locator('.new-button').click();
  await page.locator('.fullscreen-button').click();
  await page.mouse.move(-5, -5);
  const deliberation = await measure();
  await page
    .locator('.magi-display')
    .screenshot({ path: `docs/evidence/${testInfo.project.name}-reference-deliberation.png` });
  if (testInfo.project.name === 'desktop') {
    mkdirSync('.research', { recursive: true });
    writeFileSync(
      '.research/rendered-landmarks.json',
      JSON.stringify({ diagnostics, deliberation }, null, 2),
    );
    await page
      .locator('.magi-display')
      .screenshot({ path: 'docs/evidence/reference-deliberation.png' });
    await page.keyboard.press('Escape');
    await page.goto(`/?run=${fixtureIds.approved}`);
    await page.getByTestId('replay-start').click();
    await page.getByTestId('replay-controls').locator('button').first().click();
    await page.getByTestId('replay-controls').getByRole('slider').press('Home');
    await page.locator('.fullscreen-button').click();
    await page.mouse.move(-5, -5);
    await page
      .locator('.magi-display')
      .screenshot({ path: 'docs/evidence/reference-diagnostics.png' });
  }
});

test('reduced motion freezes diagnostics and opt-in sound settings persist without starting a model', async ({
  page,
  request,
}) => {
  const original = await (await request.get('/api/settings')).json();
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
    await page.goto(`/?run=${fixtureIds.approved}`);
    await page.getByTestId('replay-start').click();
    await expect(page.locator('.app-shell')).toHaveClass(/motion-off/);
    const rotor = page.locator('.balthasar .diagnostic-rotor');
    const before = await rotor.getAttribute('transform');
    await page.waitForTimeout(150);
    expect(await rotor.getAttribute('transform')).toBe(before);
    expect(await page.locator('.app-shell').getAttribute('data-sound')).toBe('off');
    const count = (await (await request.get('/api/runs')).json()).length;
    await page.locator('.operator-toolbar .sound-button').click();
    await expect(page.locator('.app-shell')).toHaveAttribute('data-sound', 'on');
    await page.reload();
    await expect(page.locator('.app-shell')).toHaveAttribute('data-sound', 'on');
    await page.locator('.operator-toolbar .sound-button').click();
    await expect(page.locator('.app-shell')).toHaveAttribute('data-sound', 'off');
    expect((await (await request.get('/api/runs')).json()).length).toBe(count);
  } finally {
    await request.put('/api/settings', { data: original });
  }
});

test('sound is silent by default and synthesizes cues only after operator opt-in', async ({
  page,
  request,
}) => {
  const original = await (await request.get('/api/settings')).json();
  try {
    await page.addInitScript(() => {
      sessionStorage.setItem('magi-booted', '1');
      const native = window.AudioContext;
      Object.assign(window, { magiTestSounds: 0 });
      window.AudioContext = class extends native {
        override createOscillator() {
          const oscillator = super.createOscillator();
          const start = oscillator.start.bind(oscillator);
          oscillator.start = (when?: number) => {
            Object.assign(window, {
              magiTestSounds: (window as unknown as { magiTestSounds: number }).magiTestSounds + 1,
            });
            start(when);
          };
          return oscillator;
        }
      };
    });
    await page.goto(`/?run=${fixtureIds.approved}`);
    await expect(page.getByTestId('final-report')).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { magiTestSounds: number }).magiTestSounds),
    ).toBe(0);
    await page.locator('.operator-toolbar .sound-button').click();
    await expect(page.locator('.app-shell')).toHaveAttribute('data-sound', 'on');
    await page.getByTestId('replay-start').click();
    await expect
      .poll(
        () => page.evaluate(() => (window as unknown as { magiTestSounds: number }).magiTestSounds),
        { timeout: 4000 },
      )
      .toBeGreaterThan(0);
    await page.getByTestId('replay-controls').locator('button').first().click();
    const count = await page.evaluate(
      () => (window as unknown as { magiTestSounds: number }).magiTestSounds,
    );
    await page.waitForTimeout(200);
    expect(
      await page.evaluate(() => (window as unknown as { magiTestSounds: number }).magiTestSounds),
    ).toBe(count);
  } finally {
    await request.put('/api/settings', { data: original });
  }
});

test('operator front view keeps text level, panels symmetric and every panel inside the frame', async ({
  page,
}) => {
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
  await page.goto(`/?run=${fixtureIds.approved}&cinema=1`);
  await expect(page.getByTestId('core-balthasar')).toHaveAttribute('data-state', 'DENY');
  const geometry = await page.locator('.magi-display').evaluate((svg) => {
    const texts = [
      ...svg.querySelectorAll<SVGTextElement>(
        '.screen-kanji text,.screen-metadata text,.screen-stamp text,.core-name,.screen-magi',
      ),
    ];
    const level = texts.every((t) => {
      const m = t.getCTM()!;
      return Math.abs(m.b) < 1e-6 && Math.abs(m.c) < 1e-6;
    });
    const polygons = [...svg.querySelectorAll<SVGPolygonElement>('.core-body')];
    const points = Object.fromEntries(
      polygons.map((p) => [
        p.closest('[data-testid]')!.getAttribute('data-testid')!,
        [...p.points].map((v) => [v.x, v.y]),
      ]),
    );
    const inside = polygons.every((p) =>
      [...p.points].every((v) => v.x >= 38 && v.x <= 666 && v.y >= 38 && v.y <= 449),
    );
    return { level, inside, points };
  });
  expect(geometry.level).toBe(true);
  expect(geometry.inside).toBe(true);
  const mirrored = geometry.points['core-casper'].map(([x, y]) => [704 - x, y]);
  for (const [x, y] of mirrored)
    expect(
      geometry.points['core-melchior'].some(
        ([a, b]) => Math.abs(a - x) < 0.001 && Math.abs(b - y) < 0.001,
      ),
    ).toBe(true);
});
