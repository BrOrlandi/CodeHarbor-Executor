const path = require('path');
const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  rootDir: projectRoot,
  testEnvironment: 'node',
  projects: [
    {
      displayName: 'unit',
      testMatch: [`${projectRoot}/tests/unit/**/*.test.js`],
      testEnvironment: 'node',
    },
    {
      displayName: 'e2e',
      testMatch: [`${projectRoot}/tests/e2e/**/*.e2e.test.js`],
      testEnvironment: 'node',
      testTimeout: 60000,
    },
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
};
