import { test, expect } from '@playwright/test';
import { createScenario } from '../fixtures/scenarios.ts';
const api = 'https://magi-free-trial.test.workers.dev';
const status = {
  available: true,
  remainingStarts: 20,
  remainingForIp: 2,
  active: 0,
  resetsAt: '2026-10-30T00:00:00.000Z',
  dailyLimit: 20,
  perIpLimit: 2,
  model: '@cf/qwen/qwen3-30b-a3b-fp8',
};

test('unconnected trial saves a private draft, refuses inference, preserves Japanese art and navigates back', async ({
  page,
}) => {
  await page.route('**/trial-config.json', (route) => route.fulfill({ json: { apiUrl: '' } }));
  const posted: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST') posted.push(r.url());
  });
  await page.goto('./?lang=ja');
  await page.getByTestId('open-trial').click();
  await expect(page).toHaveURL(/mode=trial/);
  await expect(page.getByTestId('trial-setup')).toBeVisible();
  await page.getByTestId('trial-question').fill('My private unsent question');
  await page.reload();
  await expect(page.getByTestId('trial-question')).toHaveValue('My private unsent question');
  await expect(page.getByTestId('trial-start')).toBeDisabled();
  for (const locale of ['en', 'ko', 'ja', 'zh']) {
    await page.getByTestId('trial-locale').selectOption(locale);
    await expect(page.locator('.screen-kanji text')).toHaveText(['提訴', '決議']);
    await expect(page.getByTestId('resolution-stamp')).toHaveText('待機');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  }
  expect(posted).toEqual([]);
  expect(page.url()).not.toContain('private');
  await page.getByRole('button', { name: '返回录制演示' }).click();
  await expect(page.getByTestId('demo-start')).toBeVisible();
  await page.goBack();
  await expect(page.getByTestId('trial-question')).toBeVisible();
});

test('live question receives genuine stage snapshots and a final answer, with one submission and no replay controls', async ({
  page,
}) => {
  const requests: unknown[] = [];
  await page.route('**/trial-config.json', (route) => route.fulfill({ json: { apiUrl: api } }));
  await page.route(`${api}/status`, (route) =>
    route.fulfill({ json: status, headers: { 'Access-Control-Allow-Origin': '*' } }),
  );
  const run = createScenario('approved');
  run.question = 'Should we test before launch?';
  run.settings.locale = 'en';
  const independent = structuredClone(run);
  independent.status = 'running';
  independent.phase = 'independent';
  independent.records = run.records.slice(0, 1);
  delete independent.verdict;
  delete independent.answer;
  const report = structuredClone(run);
  report.status = 'running';
  report.phase = 'report';
  report.answer = {
    status: 'generating',
    startedAt: run.createdAt,
    usage: { inputTokens: 0, outputTokens: 0, cachedTokens: 0 },
  };
  await page.route(`${api}/run`, async (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST',
        },
      });
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      contentType: 'application/x-ndjson',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body:
        [independent, report, run].map((r) => JSON.stringify({ type: 'run', run: r })).join('\n') +
        '\n',
    });
  });
  await page.goto('./?lang=en&mode=trial');
  await expect(page.getByTestId('trial-quota')).toContainText('20');
  await page.getByTestId('trial-question').fill(run.question);
  await page.getByTestId('trial-start').click();
  await expect(page.getByTestId('trial-verdict')).toContainText('APPROVED');
  await expect(page.getByTestId('answer-text')).toBeVisible();
  await expect(page.getByTestId('trial-verdict')).toBeFocused();
  await expect(page.getByTestId('trial-verdict')).toBeInViewport();
  await expect(page.getByTestId('phase-response-count')).toHaveText('3 / 3');
  await expect(page.getByTestId('trial-transcript')).toContainText('12 / 12');
  await expect(page.getByTestId('demo-seek')).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({ question: run.question, locale: 'en' });
  expect(Object.keys(requests[0] as object).sort()).toEqual(['attempt', 'locale', 'question']);
  expect(page.url()).not.toContain('Should');
});

test('quota rejection is localized, cannot fall back to Codex, and overlong questions stay unsent', async ({
  page,
}) => {
  let posts = 0;
  await page.route('**/trial-config.json', (route) => route.fulfill({ json: { apiUrl: api } }));
  await page.route(`${api}/status`, (route) =>
    route.fulfill({ json: status, headers: { 'Access-Control-Allow-Origin': '*' } }),
  );
  await page.route(`${api}/run`, (route) => {
    if (route.request().method() === 'OPTIONS')
      return route.fulfill({
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST',
        },
      });
    posts++;
    return route.fulfill({
      status: 429,
      json: { code: 'provider_limit' },
      headers: { 'Access-Control-Allow-Origin': '*' },
    });
  });
  const forbidden: string[] = [];
  page.on('request', (r) => {
    if (/openai|localhost|127\.0\.0\.1:5173|\/api\//.test(r.url())) forbidden.push(r.url());
  });
  await page.goto('./?lang=ko&mode=trial');
  await page.getByTestId('trial-question').fill('a'.repeat(801));
  await expect(page.getByTestId('trial-start')).toBeDisabled();
  await page.getByTestId('trial-question').fill('정말 실행해도 될까?');
  await page.getByTestId('trial-start').click();
  await expect(page.getByTestId('trial-error')).toContainText('무료 한도');
  expect(posts).toBe(1);
  expect(forbidden).toEqual([]);
  await expect(page.getByTestId('trial-verdict')).toHaveCount(0);
});
