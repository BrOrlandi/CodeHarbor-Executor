const path = require('path');
const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  rootDir: projectRoot,
  testEnvironment: 'node',
  projects: [
    {
      displayName: 'unit',
      rootDir: projectRoot,
      testMatch: [`${projectRoot}/tests/unit/**/*.test.js`],
      testEnvironment: 'node',
      collectCoverageFrom: [
        'src/**/*.js',
        '!**/node_modules/**',
      ],
    },
    {
      displayName: 'e2e',
      rootDir: projectRoot,
      testMatch: [`${projectRoot}/tests/e2e/**/*.e2e.test.js`],
      testEnvironment: 'node',
      testTimeout: 60000,
    },
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],
};
