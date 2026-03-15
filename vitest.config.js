import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/unit/**/*.test.js',
      'tests/e2e/**/*.e2e.test.js',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['**/node_modules/**'],
      reporter: ['text', 'text-summary', 'lcov', 'html'],
      reportsDirectory: 'coverage',
    },
    testTimeout: 10000,
  },
});
