import { test, expect } from '@playwright/test';
import { fixtureIds } from '../fixtures/scenarios.ts';

test.beforeEach(async ({ page, request }) => {
  expect((await (await request.get('/test-isolation')).json()).testOnly).toBe(true);
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
});
test('top language control switches every UI surface across four languages and persists after reload', async ({
  page,
  request,
}) => {
  const original = await (await request.get('/api/settings')).json();
  try {
    await page.goto(`/?run=${fixtureIds.approved}`);
    for (const [locale, language, config, answer, stamp] of [
      ['en', 'en', 'CONFIG', 'FINAL ANSWER', 'APPROVED'],
      ['ja', 'ja', '設定', '最終回答', '可決'],
      ['zh', 'zh-Hans', '系统设置', '最终答复', '通过'],
      ['ko', 'ko', '시스템 설정', '최종 답변', '승인'],
    ]) {
      await page.getByTestId('locale-select').selectOption(locale);
      await expect(page.getByTestId('locale-select')).toHaveValue(locale);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.getByTestId('open-config')).toHaveText(config);
      await expect(page.getByTestId('final-answer').getByRole('heading', { level: 2 })).toHaveText(
        answer,
      );
      await expect(page.getByTestId('resolution-stamp')).toHaveText(stamp);
      await page.reload();
      await expect(page.getByTestId('locale-select')).toHaveValue(locale);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
    }
    await page.getByTestId('locale-select').selectOption('en');
    await page.locator('.new-button').click();
    const displayText = await page.locator('.screen-stage').innerText();
    expect(displayText).not.toMatch(/[가-힣一-龠ぁ-ゔァ-ヴ]/);
  } finally {
    await request.put('/api/settings', { data: original });
  }
});

test('a newly submitted decision captures the selected Chinese locale without changing archived records', async ({
  page,
  request,
}) => {
  const original = await (await request.get('/api/settings')).json();
  const before = await (await request.get(`/api/runs/${fixtureIds.approved}`)).json();
  let createdId = '';
  try {
    await page.goto(`/?run=${fixtureIds.approved}`);
    await page.getByTestId('locale-select').selectOption('zh');
    await expect(page.getByTestId('locale-select')).toHaveValue('zh');
    await page.locator('.new-button').click();
    await page.locator('#proposal').fill('[TEST SLOW] language snapshot');
    const response = page.waitForResponse(
      (res) => res.request().method() === 'POST' && res.url().endsWith('/api/runs'),
    );
    await page.locator('.proposal-console button[type=submit]').click();
    const created = await (await response).json();
    createdId = created.id;
    expect(created.settings.locale).toBe('zh');
    const archived = await (await request.get(`/api/runs/${fixtureIds.approved}`)).json();
    expect(archived.records).toEqual(before.records);
  } finally {
    if (createdId) await request.post(`/api/runs/${createdId}/cancel`);
    await request.put('/api/settings', { data: original });
  }
});
