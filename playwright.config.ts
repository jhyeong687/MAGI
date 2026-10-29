import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  outputDir: './test-results/local',
  timeout: 30_000,
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:5187', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1100 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npx tsx tests/serve.ts',
    url: 'http://127.0.0.1:5187/test-isolation',
    env: { MAGI_BROWSER_TEST: '1' },
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
