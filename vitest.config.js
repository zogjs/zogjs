import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        '*.config.js',
        '*.test.js'
      ]
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
});