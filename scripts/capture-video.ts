import { chromium } from '@playwright/test';
import { spawn, execFile } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { recordedRun } from '../src/demo/recording.ts';
import { playbackTimeline } from '../src/process.ts';

const directory = resolve('.research/promo-video');
const output = resolve('docs/videos');
mkdirSync(directory, { recursive: true });
mkdirSync(output, { recursive: true });
const referenceArg = process.argv.indexOf('--reference');
const reference =
  referenceArg >= 0
    ? resolve(process.argv[referenceArg + 1])
    : resolve('.research/reference-frames/71 - SysmwHd.png');
const useReference = !process.argv.includes('--without-reference');
if (useReference && !existsSync(reference))
  throw new Error(
    'Provide a TV reference with --reference <path>, or use --without-reference. Original frames are not redistributed in the source.',
  );
const base = 'http://127.0.0.1:5191/MAGI/';
if (
  await fetch(base)
    .then(() => true)
    .catch(() => false)
)
  throw new Error('Port 5191 is already in use.');
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
    '5191',
    '--strictPort',
  ],
  { stdio: 'ignore' },
);
const exec = promisify(execFile);
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  for (let count = 0; ; count++) {
    if (
      await fetch(base)
        .then((res) => res.ok)
        .catch(() => false)
    )
      break;
    if (count > 100) throw new Error('Preview did not start.');
    await new Promise((done) => setTimeout(done, 100));
  }
  browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 960 },
    deviceScaleFactor: 1,
  });
  await page.goto(`${base}?lang=en&example=recording`);
  await page.getByTestId('demo-start').click();
  await page.getByTestId('demo-play').click();
  await page.getByTestId('demo-seek').press('End');
  await page.locator('.decision-reveal').waitFor({ state: 'hidden' });
  await page.getByTestId('share-verdict').click();
  await page.getByTestId('share-preview').waitFor();
  const download = page.waitForEvent('download');
  await page.getByTestId('download-share').click();
  await (await download).saveAs(`${output}/share-card-example.png`);
  await page.keyboard.press('Escape');
  await page.getByTestId('demo-start').click();
  await page.getByTestId('demo-play').click();
  await page.getByTestId('demo-seek').press('Home');
  await page.locator('.demo-shell').evaluate((node) => node.classList.add('film-mode'));
  const fps = 12,
    duration = 25;
  const recording = recordedRun();
  if (recording.verdict?.result !== 'DENIED' || recording.verdict.deny !== 2)
    throw new Error('Update the storyboard to match this recording before rendering.');
  const timeline = playbackTimeline(recording);
  const recordedDuration = timeline.at(-1)!.offset;
  const starts = [
    'independent',
    'cross-examination',
    'reconsideration',
    'final-vote',
    'report',
  ].map((phase) => timeline.find((frame) => frame.event.phase === phase)!.offset);
  const mapping = [
    [3.5, starts[0]],
    [7, starts[1]],
    [11, starts[2]],
    [15, starts[3]],
    [19, starts[4]],
    [21, recordedDuration],
  ];
  const recordedPosition = (time: number) => {
    if (time < 3.5) return 1500;
    if (time >= 21) return recordedDuration;
    const segment = mapping.findIndex(
      (point, i) => i < mapping.length - 1 && time >= point[0] && time < mapping[i + 1][0],
    );
    const [from, start] = mapping[segment],
      [to, end] = mapping[segment + 1];
    return Math.round(start + ((time - from) / (to - from)) * (end - start));
  };
  for (let index = 0; index < fps * duration; index++) {
    const time = index / fps;
    // The opening uses the same front-facing diagnostic pose as reference frame 71.
    const position = recordedPosition(time);
    await page.getByTestId('demo-seek').evaluate((input: HTMLInputElement, value) => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(
        input,
        String(value),
      );
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, position);
    await page.waitForFunction(
      (value) =>
        document.querySelector('.magi-screen')?.getAttribute('data-motion-time') === String(value),
      position,
    );
    await page
      .locator('.magi-screen')
      .screenshot({ path: `${directory}/${String(index).padStart(4, '0')}.png` });
    if (index % 60 === 0) console.log(`Captured ${index / fps}s / ${duration}s`);
  }
  for (const vertical of [false, true]) {
    const width = vertical ? 1080 : 1920,
      height = vertical ? 1920 : 1080;
    const screenWidth = vertical ? 1024 : 1280,
      screenHeight = screenWidth * 0.75;
    const x = vertical ? 28 : 40,
      y = vertical ? 310 : 60;
    const captions = [
      [0, 3.5, useReference ? 'FROM ANIME\nTO A WORKING TERMINAL' : 'A WORKING\nMAGI TERMINAL'],
      [3.5, 7, 'A deadline in two days.\nOne more feature?\nThree independent views.'],
      [7, 11, 'They challenge\neach other.'],
      [11, 15, 'They reconsider\ntheir positions.'],
      [15, 19, 'Three final votes.\nThe result is not scripted.'],
      [19, 21, 'VERDICT: DENIED\nTwo votes to one.'],
      [21, 23, 'Defer the feature.\nPresent the working app.'],
      [23, 25, 'TRY THE INTERACTIVE DEMO\nNo login required.'],
    ] as const;
    for (const [index, [from, to, caption]] of captions.entries()) {
      const encoded = await page.evaluate(
        ({ width, height, vertical, caption, referenceCredit, recordedSeconds }) => {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          const tx = vertical ? 64 : 1390;
          const blocks = [
            {
              value: 'MAGI',
              x: tx,
              y: vertical ? 190 : 275,
              size: vertical ? 130 : 96,
              color: '#efa837',
              bold: true,
            },
            {
              value: 'It debates before\nit decides.',
              x: tx,
              y: vertical ? 1220 : 370,
              size: vertical ? 62 : 40,
              color: '#f1dfbf',
              bold: true,
            },
            {
              value: caption,
              x: tx,
              y: vertical ? 1410 : 570,
              size: vertical ? 43 : 28,
              color: '#d9c5a3',
              bold: false,
            },
            {
              value: 'jhyeong687.github.io/MAGI',
              x: vertical ? 64 : tx,
              y: vertical ? 1740 : 790,
              size: vertical ? 35 : 23,
              color: '#8ad9ba',
              bold: false,
            },
            {
              value: 'github.com/jhyeong687/MAGI',
              x: vertical ? 64 : tx,
              y: vertical ? 1798 : 840,
              size: vertical ? 28 : 20,
              color: '#c7ad82',
              bold: false,
            },
            {
              value: `RECORDED CODEX / EDITED TIMING\n${recordedSeconds}s SESSION / UNOFFICIAL FAN PROJECT`,
              x: vertical ? 64 : tx,
              y: vertical ? 1852 : 948,
              size: vertical ? 19 : 15,
              color: '#ab9575',
              bold: false,
            },
          ];
          if (referenceCredit)
            blocks.push({
              value: 'TV REFERENCE: 1995 SERIES / SOURCE: GWERN.NET ARCHIVE',
              x: 64,
              y: vertical ? 275 : 34,
              size: vertical ? 16 : 15,
              color: '#9a896b',
              bold: false,
            });
          for (const block of blocks) {
            ctx.font = `${block.bold ? 'bold ' : ''}${block.size}px Arial, sans-serif`;
            ctx.fillStyle = block.color;
            block.value
              .split('\n')
              .forEach((line, row) =>
                ctx.fillText(
                  line,
                  block.x,
                  block.y + row * (block.size + 14),
                  width - block.x - 35,
                ),
              );
          }
          return canvas.toDataURL('image/png').split(',')[1];
        },
        {
          width,
          height,
          vertical,
          caption,
          referenceCredit: useReference && from === 0,
          recordedSeconds: (recordedDuration / 1000).toFixed(1),
        },
      );
      const path = `${directory}/overlay-${vertical ? 'v' : 'h'}-${index}.png`;
      writeFileSync(path, Buffer.from(encoded, 'base64'));
    }
    const composed = `${directory}/composed-${vertical ? 'v' : 'h'}`;
    mkdirSync(composed, { recursive: true });
    const referenceData = useReference
      ? `data:image/png;base64,${readFileSync(reference).toString('base64')}`
      : null;
    const overlayData = captions.map(
      (_, index) =>
        `data:image/png;base64,${readFileSync(`${directory}/overlay-${vertical ? 'v' : 'h'}-${index}.png`).toString('base64')}`,
    );
    for (let index = 0; index < fps * duration; index++) {
      const time = index / fps;
      const captionIndex = captions.findIndex(([from, to]) => time >= from && time < to);
      const encoded = await page.evaluate(
        async ({
          width,
          height,
          x,
          y,
          screenWidth,
          screenHeight,
          app,
          reference,
          caption,
          alpha,
        }) => {
          const sources = [app, caption, ...(reference ? [reference] : [])];
          const images = await Promise.all(
            sources.map(async (source) => {
              const image = new Image();
              image.src = source;
              await image.decode();
              return image;
            }),
          );
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(images[0], x, y, screenWidth, screenHeight);
          if (images[2] && alpha > 0) {
            ctx.globalAlpha = alpha;
            ctx.drawImage(images[2], x, y, screenWidth, screenHeight);
            ctx.globalAlpha = 1;
          }
          ctx.drawImage(images[1], 0, 0);
          return canvas.toDataURL('image/png').split(',')[1];
        },
        {
          width,
          height,
          x,
          y,
          screenWidth,
          screenHeight,
          app: `data:image/png;base64,${readFileSync(`${directory}/${String(index).padStart(4, '0')}.png`).toString('base64')}`,
          reference: referenceData,
          caption: overlayData[captionIndex],
          alpha: time < 0.9 ? 1 : Math.max(0, (2.6 - time) / 1.7),
        },
      );
      writeFileSync(
        `${composed}/${String(index).padStart(4, '0')}.png`,
        Buffer.from(encoded, 'base64'),
      );
    }
    await exec(
      'ffmpeg',
      [
        '-y',
        '-loglevel',
        'error',
        '-framerate',
        String(fps),
        '-i',
        `${composed}/%04d.png`,
        '-t',
        String(duration),
        '-an',
        '-r',
        '30',
        '-c:v',
        'libx264',
        '-preset',
        'fast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-threads',
        '2',
        `${output}/magi-demo${vertical ? '-vertical' : ''}.mp4`,
      ],
      { maxBuffer: 5_000_000 },
    );
    rmSync(composed, { recursive: true });
    console.log(`Rendered ${width}×${height} MP4.`);
  }
  await exec('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-ss',
    '8',
    '-i',
    `${output}/magi-demo.mp4`,
    '-frames:v',
    '1',
    `${output}/magi-demo-poster.png`,
  ]);
  writeFileSync(
    `${output}/provenance.json`,
    JSON.stringify(
      {
        kind: 'recorded-public-codex-session',
        realModelOutput: true,
        recordedSessionSeconds: recordedDuration / 1000,
        sourceRecord: '../../demo/recordings/public-run.json',
        editedTiming: true,
        durationSeconds: 25,
        originalReferenceVisibleSeconds: useReference ? 2.6 : 0,
        referenceSource: useReference
          ? 'https://gwern.net/doc/anime/eva/2017-10-13-ui99nkgbt-imgur-neongenesisevangelionuserinterfacescreenshots.zip (frame 71)'
          : null,
        originalAudioUsed: false,
        personalRecordsUsed: false,
      },
      null,
      2,
    ),
  );
  // Keep captions and a few contact-sheet frames as local verification evidence.
  for (let index = 0; index < fps * duration; index++)
    if (![0, 18, 36, 96, 168, 240, 288].includes(index))
      rmSync(`${directory}/${String(index).padStart(4, '0')}.png`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
