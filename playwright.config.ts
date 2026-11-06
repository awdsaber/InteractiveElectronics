import { defineConfig } from '@playwright/test'

// Smoke tests run in the system Chrome with software WebGL (SwiftShader), so no GPU is needed.
const PORT = 5179

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
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
})
