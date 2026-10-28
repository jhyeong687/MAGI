import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/demo',
  outputDir: './test-results/demo',
  timeout: 30_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5190/MAGI/', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1100 } } },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: 'npm run preview:demo',
    url: 'http://127.0.0.1:5190/MAGI/',
    reuseExistingServer: false,
  },
});
