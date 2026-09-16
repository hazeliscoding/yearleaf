import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the browser build (`ng serve`, in-memory
 * persistence). Tauri-shell behavior is exercised separately; these cover
 * canvas interaction, which is identical in both hosts.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4300',
    viewport: { width: 1400, height: 900 },
    // Headless Chromium needs software WebGL for the PixiJS scene.
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'pnpm exec ng serve --port 4300',
    url: 'http://localhost:4300',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
