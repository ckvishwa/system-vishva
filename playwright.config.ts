import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  // One worker: the idle-frame, WebGL-context and timing tests measure the browser itself, and parallel pages starve each other.
  workers: 1,
  webServer: { command: 'npm run preview -- --port 4321', port: 4321, reuseExistingServer: true },
  use: {
    baseURL: 'http://localhost:4321',
    // Optional: PW_CHANNEL=chrome runs against an installed Chrome when the bundled browser can't be downloaded.
    channel: process.env.PW_CHANNEL || undefined,
  },
});
