import { defineConfig } from '@playwright/test'

// Smoke tests run in the system Chrome with software WebGL (SwiftShader), so no GPU is needed.
// E2E_PORT lets parallel worktrees run the suite side by side. Never reuse a running server:
// it may be serving another worktree's code.
const PORT = Number((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.E2E_PORT ?? 5389)

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/InteractiveElectronics/`,
    channel: 'chrome',
    headless: true,
    viewport: { width: 1440, height: 900 },
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/InteractiveElectronics/`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
})
