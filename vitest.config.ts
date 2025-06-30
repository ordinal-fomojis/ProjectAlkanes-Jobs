import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    silent: 'passed-only',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'istanbul'
    },
  },
})
