import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  // One worker: the idle-frame, WebGL-context and timing tests measure the browser itself, and parallel pages starve each other.
  workers: 1,
  webServer: { command: 'npm run preview -- --port 4321', port: 4321, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:4321' },
  projects: [
    // Everything runs in Chromium. Optional: PW_CHANNEL=chrome runs against an installed Chrome when the bundled browser can't be downloaded.
    { name: 'chromium', use: { browserName: 'chromium', channel: process.env.PW_CHANNEL || undefined } },
    // WebKit only renders the teardown screenshots: it is where CSS 3D, preserve-3d and safe-area differences would show first.
    { name: 'webkit', testMatch: /teardown-shots\.spec\.ts/, use: { browserName: 'webkit' } },
  ],
});
