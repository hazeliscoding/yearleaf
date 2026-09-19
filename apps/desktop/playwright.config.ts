import { defineConfig } from '@playwright/test';

/**
 * End-to-end tests against the browser build (`ng serve`, in-memory
 * persistence). Tauri-shell behavior is exercised separately; these cover
 * canvas interaction, which is identical in both hosts.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // A committed `test.only` runs one test and reports success for the suite,
  // which is the precise shape of a green badge over something that cannot
  // fail. Locally it stays allowed, because focusing a test is how you work on
  // one.
  forbidOnly: !!process.env['CI'],
  // The console reporter leaves nothing on disk, so the workflow's
  // upload-on-failure step had nothing to upload. A failure in CI is the one
  // time nobody can rerun it locally with the same state, so it writes the
  // report as well as printing it.
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4300',
    viewport: { width: 1400, height: 900 },
    // Headless Chromium needs software WebGL for the PixiJS scene.
    launchOptions: { args: ['--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'pnpm exec ng serve --port 4300',
    url: 'http://localhost:4300',
    // Never reuse. A server left behind by an earlier run keeps serving the
    // bundle it started with, and `ng serve` rebuilds on its own schedule — so
    // a reused one answers with code that is not in the working tree and the
    // suite passes for a tree nobody has. That cost a false pass and three
    // killed servers in one afternoon. Refusing to reuse turns it into a
    // loud "port already in use" instead, and costs nothing in the ordinary
    // case, where there is no server to reuse.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
