import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { recordedRun } from '../src/demo/recording.ts';
import { playbackTimeline } from '../src/process.ts';

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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1350 } });
  mkdirSync('docs/screenshots', { recursive: true });
  const ready = async () => {
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('.scene-chrome')!).opacity === '1',
    );
    await page.evaluate(() => document.fonts.ready);
  };
  const overview = async (name: string) => {
    await ready();
    const stage = (await page.locator('.demo-stage').boundingBox())!;
    await page.screenshot({
      path: `docs/screenshots/${name}.png`,
      clip: { x: 0, y: 0, width: 1440, height: Math.ceil(stage.y + stage.height + 20) },
    });
  };
  await page.goto(base);
  await overview('demo-desktop');
  await page.goto(`${base}?lang=en&example=recording`);
  await overview('demo-english');
  await page.getByTestId('demo-start').click();
  await page.getByTestId('demo-play').click();
  const seek = async (position: number) => {
    await page.getByTestId('demo-seek').evaluate((input: HTMLInputElement, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        String(value),
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, position);
    await expect(page.locator('.magi-screen')).toHaveAttribute(
      'data-motion-time',
      String(position),
    );
  };
  await seek(1500);
  await page.locator('.magi-screen').screenshot({ path: 'docs/screenshots/demo-independent.png' });
  const twoResponses = playbackTimeline(recordedRun()).find(
    (frame) => frame.event.phase === 'independent' && frame.event.recordCount === 2,
  )!.offset;
  await seek(twoResponses);
  await page
    .getByTestId('deliberation-status')
    .screenshot({ path: 'docs/screenshots/demo-progress.png' });
  const cross = playbackTimeline(recordedRun()).find(
    (frame) => frame.event.phase === 'cross-examination',
  )!.offset;
  await seek(cross + 1500);
  await page.locator('.magi-screen').screenshot({ path: 'docs/screenshots/demo-debate.png' });
  await page.getByTestId('demo-finish').click();
  // Waiting for the focus handoff proves that the verdict reveal actually finished;
  // a hidden-only wait can pass before React has mounted the reveal overlay.
  await expect(page.getByTestId('demo-answer-target')).toBeFocused();
  await expect(page.locator('.decision-reveal')).toHaveCount(0);
  await expect(page.getByTestId('answer-text')).toContainText('Denied by a 2–1 vote');
  await page.getByTestId('final-answer').screenshot({ path: 'docs/screenshots/demo-recorded.png' });
  await page.locator('.demo-transcript').evaluate((node: HTMLDetailsElement) => {
    node.open = true;
  });
  await page
    .locator('.demo-transcript')
    .screenshot({ path: 'docs/screenshots/demo-transcript.png' });
  await page.getByTestId('share-verdict').click();
  await page.getByTestId('share-preview').waitFor();
  await page.getByRole('dialog').screenshot({ path: 'docs/screenshots/share-preview.png' });
  const download = page.waitForEvent('download');
  await page.getByTestId('download-share').click();
  await (await download).saveAs('docs/videos/share-card-example.png');
  await page.keyboard.press('Escape');
  await page.getByTestId('guide-project').click();
  await page
    .getByTestId('question-guide')
    .screenshot({ path: 'docs/screenshots/demo-question-guide.png' });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await mobile.goto(base);
  await expect(mobile.getByTestId('demo-start')).toBeInViewport();
  await mobile.waitForFunction(
    () => getComputedStyle(document.querySelector('.scene-chrome')!).opacity === '1',
  );
  await mobile.screenshot({ path: 'docs/screenshots/demo-mobile.png' });
  await mobile.goto(`${base}?lang=ja&example=recording&view=result`);
  await expect(mobile.getByTestId('demo-answer-target')).toBeFocused();
  await mobile
    .getByTestId('final-answer')
    .screenshot({ path: 'docs/screenshots/demo-answer-mobile.png' });
  writeFileSync(
    'docs/screenshots/README.md',
    `# Screenshot provenance\n\nThe \`demo-*.png\` images and \`share-preview.png\` are captured by \`npx tsx scripts/capture-demo-assets.ts\` from the static public demo on isolated port 5192. Except for the question helper below, they use the actual purpose-made public Codex recording, preserve its original English assessments and answer, and contain no account credentials or private history. Localized question headlines and card summaries are faithful editorial translations. The final-answer capture waits for the completed reveal and focus handoff. The brief of this existing recording is extracted from its saved answer, conditions and disagreement without changing the original. No model calls are made.\n\n\`demo-question-guide.png\` shows an authored, editable project-question template. It is a browser-only draft, not an executed question or model response.\n\nOther screenshots and \`processing.gif\` use authored documentation examples captured by \`npm run screenshots\` on isolated port 5187. They illustrate the local interface, not model performance or inference speed.\n\nThe repository cover and social preview reuse the illustrative processing GIF. Source: \`scripts/readme-cover.html\`; regenerate with \`npm run social-preview\`. Cover: 1600×720. Social preview: 1200×630.\n`,
  );
  console.log(
    'Captured actual public analysis, debate, final answer, reviewed card and mobile start. No model calls.',
  );
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
