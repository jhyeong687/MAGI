import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

// Reuse the local interface example; no account, server or model call is required.
const browser = await chromium.launch();
try {
  mkdirSync('docs/media', { recursive: true });
  const page = await browser.newPage({
    viewport: { width: 1600, height: 720 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(resolve('scripts/readme-cover.html')).href);
  await page.locator('.terminal').evaluate(async (image: HTMLImageElement) => {
    await image.decode();
  });
  await page.screenshot({ path: 'docs/media/readme-cover.png' });
  await page.evaluate(() => document.body.classList.add('social'));
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.screenshot({ path: 'docs/social-preview.png' });
  console.log('Saved repository cover (1600 × 720) and social preview (1200 × 630).');
} finally {
  await browser.close();
}
