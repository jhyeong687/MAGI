import { test, expect } from '@playwright/test';
import { fixtureIds } from '../fixtures/scenarios.ts';

test.beforeEach(async ({ page, request }) => {
  expect((await (await request.get('/test-isolation')).json()).testOnly).toBe(true);
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
});
test('language control localizes the operator UI while preserving Japanese MAGI artwork after reload', async ({
  page,
  request,
}) => {
  const original = await (await request.get('/api/settings')).json();
  try {
    await page.goto(`/?run=${fixtureIds.approved}`);
    for (const [locale, language, config, answer] of [
      ['en', 'en', 'CONFIG', 'FINAL ANSWER'],
      ['ja', 'ja', '設定', '最終回答'],
      ['zh', 'zh-Hans', '系统设置', '最终答复'],
      ['ko', 'ko', '시스템 설정', '최종 답변'],
    ]) {
      await page.getByTestId('locale-select').selectOption(locale);
      await expect(page.getByTestId('locale-select')).toHaveValue(locale);
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.getByTestId('open-config')).toHaveText(config);
      await expect(page.getByTestId('final-answer').getByRole('heading', { level: 2 })).toHaveText(
        answer,
      );
      await expect(page.getByTestId('resolution-stamp')).toHaveText('可決');
      await expect(page.locator('.screen-kanji text')).toHaveText(['提訴', '決議']);
      await expect(page.locator('.magi-display')).toHaveAttribute('lang', 'ja');
      await expect(page.locator('.command-masthead div > span')).toHaveText('三賢人合議システム');
      await page.reload();
      await expect(page.getByTestId('locale-select')).toHaveValue(locale);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
    }
    await page.getByTestId('locale-select').selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.locator('.new-button').click();
    await expect(page.getByTestId('resolution-stamp')).toHaveText('待機');
    await expect(page.locator('.sequence-strip')).not.toContainText(/[가-힣一-龠ぁ-ゔァ-ヴ]/);
    await expect(page.locator('.screen-kanji text')).toHaveText(['提訴', '決議']);
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
