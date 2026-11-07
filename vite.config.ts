import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/InteractiveElectronics/',
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    passWithNoTests: true,
    // Lesson tests simulate many seconds of circuit time; give them room on a loaded machine or CI.
    testTimeout: 60_000,
  },
})
