import { defineConfig, devices } from '@playwright/test';

const isLiveTarget = (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:80').includes(':80') || (process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:80').endsWith('localhost');

export default defineConfig({
  testDir: './e2e',
  timeout: 45 * 1000,
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:80',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  ...(isLiveTarget
    ? {}
    : {
        webServer: {
          command: 'npm run preview -- --port 5173',
          port: 5173,
          reuseExistingServer: !process.env.CI,
          timeout: 30 * 1000,
        },
      }),
});
