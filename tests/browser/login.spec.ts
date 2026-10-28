import { test, expect } from '@playwright/test';

test('signed-out onboarding opens a local sign-in, waits for account verification and starts no model calls', async ({
  page,
  request,
}) => {
  const guard = await (await request.get('/test-isolation')).json();
  expect(guard.testOnly).toBe(true);
  await page.addInitScript(() => sessionStorage.setItem('magi-booted', '1'));
  let connected = false,
    status = 'idle',
    submitted = 0,
    loginRequests = 0;
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().endsWith('/api/runs')) submitted++;
  });
  await page.route('**/api/environment*', (route) =>
    route.fulfill({
      json: {
        ready: connected,
        auth: connected ? 'chatgpt' : 'missing',
        binary: 'TEST_ONLY',
        checkedAt: new Date().toISOString(),
        capabilities: [],
        issues: [],
        usageNotice: '',
      },
    }),
  );
  await page.route('**/api/auth', (route) => route.fulfill({ json: { status } }));
  await page.route('**/api/auth/login', async (route) => {
    loginRequests++;
    status = 'pending';
    await route.fulfill({ json: { status } });
  });
  await page.goto('/');
  await expect(page.getByTestId('auth-panel')).toBeVisible();
  await page.getByRole('button', { name: /ChatGPT로 로그인/ }).click();
  await expect(page.getByRole('button', { name: /브라우저에서 로그인을 완료하라/ })).toBeDisabled();
  expect(loginRequests).toBe(1);
  expect(submitted).toBe(0);
  connected = true;
  status = 'completed';
  await expect(page.getByTestId('auth-panel')).toHaveCount(0, { timeout: 5000 });
  await expect(page.locator('.link-status')).toContainText('정상');
  expect(submitted).toBe(0);
});
