import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
const base = 'http://127.0.0.1:5192/MAGI/';
if (
  await fetch(base)
    .then(() => true)
    .catch(() => false)
)
  throw new Error('Port 5192 is occupied.');
const server = spawn(
  process.execPath,
  [
    resolve('node_modules/vite/bin/vite.js'),
    'preview',
    '--mode',
    'demo',
    '--host',
    '127.0.0.1',
    '--port',
    '5192',
    '--strictPort',
  ],
  { stdio: 'ignore' },
);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  for (let attempt = 0; ; attempt++) {
    if (
      await fetch(base)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    if (attempt > 100) throw new Error('Preview failed to start.');
    await new Promise((done) => setTimeout(done, 100));
  }
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  mkdirSync('docs/screenshots', { recursive: true });
  await page.goto(base);
  await page.waitForFunction(
    () => getComputedStyle(document.querySelector('.scene-chrome')!).opacity === '1',
  );
  await page.screenshot({ path: 'docs/screenshots/demo-desktop.png' });
  await page.goto(`${base}?lang=en&example=recording`);
  await page.getByTestId('demo-start').click();
  await page.getByTestId('demo-finish').click();
  await page.locator('.decision-reveal').waitFor({ state: 'hidden' });
  await page.getByTestId('final-answer').screenshot({ path: 'docs/screenshots/demo-recorded.png' });
  await page.getByTestId('share-verdict').click();
  await page.getByTestId('share-preview').waitFor();
  await page.getByRole('dialog').screenshot({ path: 'docs/screenshots/share-preview.png' });
  const event = page.waitForEvent('download');
  await page.getByTestId('download-share').click();
  await (await event).saveAs('docs/videos/share-card-example.png');
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(base);
  await mobile.waitForFunction(
    () => getComputedStyle(document.querySelector('.scene-chrome')!).opacity === '1',
  );
  await mobile.screenshot({ path: 'docs/screenshots/demo-mobile.png', fullPage: true });
  console.log(
    'Captured public demo, actual recording, reviewed share card and mobile layout. No model calls.',
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
