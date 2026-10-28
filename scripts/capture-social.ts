import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.goto(pathToFileURL(resolve('scripts/social-card.html')).href);
  await page.locator('.terminal').evaluate(async (image: HTMLImageElement) => {
    await image.decode();
  });
  await page.screenshot({ path: 'docs/social-preview.png' });
  console.log('Saved docs/social-preview.png (1200 × 630).');
} finally {
  await browser.close();
}
