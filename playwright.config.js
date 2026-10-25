import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  use: {
    ...devices['iPhone 15'],
    baseURL: 'http://127.0.0.1:4174/',
  },
  projects: [{ name: 'webkit-iphone', use: { browserName: 'webkit' } }],
  webServer: {
    command: 'python3 -m http.server 4174 --bind 127.0.0.1',
    url: 'http://127.0.0.1:4174/',
    reuseExistingServer: !process.env.CI,
  },
});
