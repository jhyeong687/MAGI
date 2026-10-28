// Reproducible documentation gallery. Uses only the isolated test server and examples.
import { chromium } from '@playwright/test';
import { spawn, execFile } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { showcaseId } from '../tests/fixtures/showcase.ts';

const base = 'http://127.0.0.1:5187';
if (
  await fetch(`${base}/test-isolation`)
    .then(() => true)
    .catch(() => false)
)
  throw new Error('Port 5187 is in use. Stop browser tests before capturing.');
const directory = resolve('docs/screenshots');
mkdirSync(directory, { recursive: true });
const server = spawn(process.execPath, ['--import', 'tsx', 'tests/serve.ts'], {
  env: { ...process.env, MAGI_BROWSER_TEST: '1', MAGI_SHOWCASE: '1' },
  stdio: 'ignore',
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  const deadline = Date.now() + 30_000;
  while (true) {
    const guard = await fetch(`${base}/test-isolation`)
      .then((res) => res.json())
      .catch(() => null);
    if (guard?.testOnly && guard.realCli === false) break;
    if (Date.now() > deadline) throw new Error('Isolated screenshot server did not start.');
    await new Promise((done) => setTimeout(done, 200));
  }
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 1500 } });
  await context.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
  const page = await context.newPage();
  await page.goto(`${base}/?run=${showcaseId}`);
  await page.getByTestId('answer-text').waitFor();
  await page.waitForTimeout(300);
  const stage = (await page.locator('.screen-stage').boundingBox())!;
  await page.screenshot({
    path: `${directory}/desktop.png`,
    clip: { x: 0, y: 0, width: 1440, height: Math.ceil(stage.y + stage.height + 16) },
  });
  await page.screenshot({ path: `${directory}/desktop-full.png`, fullPage: true });
  await page.getByTestId('final-answer').screenshot({ path: `${directory}/answer.png` });
  await page.getByTestId('open-transcript').click();
  await page.getByRole('dialog').screenshot({ path: `${directory}/debate-transcript.png` });
  await page.keyboard.press('Escape');
  await page.getByTestId('core-casper').click();
  await page.getByRole('dialog').screenshot({ path: `${directory}/persona.png` });
  await page.keyboard.press('Escape');
  await page.getByTestId('open-config').click();
  await page.getByRole('dialog').screenshot({ path: `${directory}/settings.png` });
  await page.keyboard.press('Escape');
  await page.getByTestId('replay-start').click();
  const controls = page.getByTestId('replay-controls');
  await controls.locator('button').first().click();
  const seek = async (position: number) => {
    await controls.getByRole('slider').evaluate((input: HTMLInputElement, value: number) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        String(value),
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, position);
    await page.waitForTimeout(250);
  };
  await seek(2500);
  await page.locator('.screen-stage').screenshot({ path: `${directory}/independent.png` });
  await seek(27500);
  if ((await page.locator('.reference-plane').getAttribute('data-phase')) !== 'cross-examination')
    throw new Error('Gallery seek did not reach cross-examination.');
  await page.locator('.screen-stage').screenshot({ path: `${directory}/debate.png` });
  const frames = resolve('.research/showcase-frames');
  mkdirSync(frames, { recursive: true });
  for (let index = 0; index < 40; index++) {
    await seek(27500 + index * 200);
    // Paused replay freezes animation intentionally; exact positions still show the light pattern.
    await page
      .locator('.magi-screen')
      .screenshot({ path: `${frames}/${String(index).padStart(3, '0')}.png` });
  }
  await promisify(execFile)('ffmpeg', [
    '-y',
    '-framerate',
    '5',
    '-i',
    `${frames}/%03d.png`,
    '-filter_complex',
    'scale=720:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=48[p];[b][p]paletteuse',
    '-loop',
    '0',
    `${directory}/processing.gif`,
  ]);
  rmSync(frames, { recursive: true, force: true });
  const mobile = await context.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });
  await mobile.goto(`${base}/?run=${showcaseId}`);
  await mobile.getByTestId('answer-text').waitFor();
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: `${directory}/mobile.png`, fullPage: true });
  for (const locale of ['en', 'ko', 'ja', 'zh']) {
    await page.getByTestId('locale-select').selectOption(locale);
    await page.waitForFunction(
      (value) => document.querySelector('.app-shell')?.getAttribute('data-locale') === value,
      locale,
    );
    await page.locator('.operator-toolbar').scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `${directory}/language-${locale}.png`,
      clip: { x: 0, y: 0, width: 1440, height: 850 },
    });
  }
  await page.getByTestId('locale-select').selectOption('en');
  await page.waitForFunction(() => document.documentElement.lang === 'en');
  const signedOut = await context.newPage();
  await signedOut.route('**/api/environment*', (route) =>
    route.fulfill({
      json: {
        ready: false,
        auth: 'missing',
        binary: 'project Codex',
        checkedAt: new Date().toISOString(),
        issues: [],
        capabilities: [],
        usageNotice: '',
      },
    }),
  );
  await signedOut.goto(base);
  await signedOut.getByTestId('auth-panel').waitFor();
  await signedOut.screenshot({
    path: `${directory}/login.png`,
    clip: { x: 0, y: 0, width: 1440, height: 600 },
  });
  writeFileSync(
    `${directory}/README.md`,
    '# Screenshot provenance\n\nThese screenshots and the GIF were generated by `npm run screenshots` from the isolated test server on port 5187. Questions, public opinions, votes and timing are authored documentation examples, not live model output. No real account, credentials or personal decision history was loaded. Production has no demo-response endpoint.\n',
  );
  console.log(
    'Saved the documentation gallery with four language previews. No model calls or production records used.',
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
