import { test, expect } from '@playwright/test';
import { fixtureIds } from '../fixtures/scenarios.ts';
import { defaultPrompts, PERSONAS, personaInfo, personaProfiles } from '../../shared/domain.ts';
test.beforeEach(async ({ page, request }) => {
  const guard = await (await request.get('/test-isolation')).json();
  expect(guard.testOnly).toBe(true);
  expect(guard.realCli).toBe(false);
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
});
test('all three original aspects remain inspectable with the actual final opinions and in individual records', async ({
  page,
}) => {
  await page.goto(`/?run=${fixtureIds.approved}`);
  await expect(page.getByTestId('answer-text')).toBeVisible();
  await expect(page.locator('.answer-sources')).not.toHaveAttribute('open', '');
  await page.locator('.answer-sources > summary').click();
  for (const persona of PERSONAS) {
    await expect(page.locator('.answer-sources')).toContainText(
      personaProfiles[persona].labels.ko.aspect,
    );
    await expect(page.locator('.answer-sources')).toContainText(personaInfo[persona].name);
    await page.getByTestId(`core-${persona}`).click();
    await expect(page.locator('.core-details .persona-context')).toContainText(
      personaProfiles[persona].labels.ko.lens,
    );
    await page.keyboard.press('Escape');
  }
  await page.getByTestId('open-transcript').click();
  await expect(page.locator('.entry-perspective')).toHaveCount(12);
});
test('the revised preset is editable and a user personality edit survives save and reload', async ({
  page,
  request,
}) => {
  const original = await (await request.get('/api/settings')).json();
  try {
    await page.goto('/');
    await page.getByTestId('open-config').click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /기본 인격 복원/ }).click();
    for (const [index, persona] of PERSONAS.entries())
      await expect(dialog.locator('textarea').nth(index)).toHaveValue(defaultPrompts[persona]);
    const custom = defaultPrompts.casper + '\nKeep my explicit custom emphasis.';
    await dialog.locator('textarea').nth(2).fill(custom);
    await dialog.locator('button[type=submit]').click();
    await page.reload();
    await page.getByTestId('open-config').click();
    await expect(page.getByRole('dialog').locator('textarea').nth(2)).toHaveValue(custom);
    expect((await (await request.get('/api/settings')).json()).prompts.casper).toBe(custom);
  } finally {
    await request.put('/api/settings', { data: original });
  }
});
