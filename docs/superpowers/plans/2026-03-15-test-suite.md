# Test Suite Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comprehensive unit tests with coverage reporting and E2E tests that start the server and validate the full execution pipeline via HTTP.

**Architecture:** Jest as test runner with coverage via `--coverage`. Unit tests mock `fs`, `child_process` and service dependencies to test each module in isolation. E2E tests spin up a real server on a random port, use a temporary directory for executions/cache, and call the API with `fetch`. Supertest is NOT used — real HTTP calls exercise the full middleware stack.

**Tech Stack:** Jest, Node.js native `fetch` (Node 22+), `fs/promises` for temp dirs

---

## File Structure

```
tests/
├── unit/
│   ├── utils/
│   │   ├── parseUtils.test.js        # parseFileSize, formatFileSize
│   │   └── fileUtils.test.js         # ensureDirs, getDirectorySize
│   ├── middleware/
│   │   └── auth.test.js              # auth middleware
│   ├── services/
│   │   ├── dependencyService.test.js # extractDependencies, extractBasePackageName, isNativeModule, checkForMissingDependencies, installDependencies, pinned versions
│   │   ├── cacheService.test.js      # getCacheEntries, cleanupCache, getCacheEntryInfo
│   │   └── executionService.test.js  # createExecutionDir, pruneOldExecutionDirs, executeCode, cleanupExecutionDir
│   └── controllers/
│       └── executionController.test.js # formatBytes, filterErrorStack, healthCheck, verifyAuth, executeCode (mocked)
├── e2e/
│   ├── setup.js                      # Server lifecycle helpers (start/stop) with require.cache clearing
│   ├── health.e2e.test.js            # GET /health
│   ├── auth.e2e.test.js              # Auth flow (verify-auth, missing token, wrong token)
│   └── execute.e2e.test.js           # POST /execute (simple code, deps, errors, debug, timeout, console, cache)
└── jest.config.js                    # Jest configuration (unit + e2e projects)
```

**Modified files:**
- `package.json` — add jest devDependency, test scripts

---

## Chunk 1: Setup and Utility Tests

### Task 1: Install Jest and configure test infrastructure

**Files:**
- Modify: `package.json`
- Create: `tests/jest.config.js`

- [ ] **Step 1: Install Jest**

Run: `cd /Users/brunoorlandi/Projects/CodeHarbor-Executor && pnpm add -D jest`

- [ ] **Step 2: Create Jest config**

Create `tests/jest.config.js`:

```js
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.js'],
      testEnvironment: 'node',
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.e2e.test.js'],
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
```

- [ ] **Step 3: Update package.json scripts**

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "test": "jest --config tests/jest.config.js",
    "test:unit": "jest --config tests/jest.config.js --selectProjects unit",
    "test:e2e": "jest --config tests/jest.config.js --selectProjects e2e",
    "test:coverage": "jest --config tests/jest.config.js --selectProjects unit --coverage"
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml tests/jest.config.js
git commit -m "chore: add jest and test infrastructure"
```

---

### Task 2: Unit tests for parseUtils

**Files:**
- Create: `tests/unit/utils/parseUtils.test.js`
- Test target: `src/utils/parseUtils.js`

- [ ] **Step 1: Write tests**

Create `tests/unit/utils/parseUtils.test.js`:

```js
const { parseFileSize, formatFileSize } = require('../../../src/utils/parseUtils');

describe('parseFileSize', () => {
  it('parses bytes', () => {
    expect(parseFileSize('100B')).toBe(100);
  });

  it('parses kilobytes', () => {
    expect(parseFileSize('1KB')).toBe(1024);
  });

  it('parses megabytes', () => {
    expect(parseFileSize('500MB')).toBe(500 * 1024 * 1024);
  });

  it('parses gigabytes', () => {
    expect(parseFileSize('1GB')).toBe(1024 * 1024 * 1024);
  });

  it('parses terabytes', () => {
    expect(parseFileSize('2TB')).toBe(2 * 1024 * 1024 * 1024 * 1024);
  });

  it('parses decimal values', () => {
    expect(parseFileSize('1.5GB')).toBe(1.5 * 1024 * 1024 * 1024);
  });

  it('is case insensitive', () => {
    expect(parseFileSize('1gb')).toBe(1024 * 1024 * 1024);
    expect(parseFileSize('1Gb')).toBe(1024 * 1024 * 1024);
  });

  it('returns number as-is if not a string', () => {
    expect(parseFileSize(1024)).toBe(1024);
  });

  it('defaults to 1GB for invalid strings', () => {
    expect(parseFileSize('invalid')).toBe(1073741824);
  });

  it('parses numeric string without unit', () => {
    expect(parseFileSize('2048')).toBe(2048);
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 bytes');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.00 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });

  it('formats zero', () => {
    expect(formatFileSize(0)).toBe('0 bytes');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:unit -- --testPathPattern=parseUtils`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/utils/parseUtils.test.js
git commit -m "test: add unit tests for parseUtils"
```

---

### Task 3: Unit tests for fileUtils

**Files:**
- Create: `tests/unit/utils/fileUtils.test.js`
- Test target: `src/utils/fileUtils.js`

- [ ] **Step 1: Write tests**

Create `tests/unit/utils/fileUtils.test.js`:

```js
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { ensureDirs, getDirectorySize } = require('../../../src/utils/fileUtils');

describe('ensureDirs', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileutils-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates directories that do not exist', async () => {
    const dir1 = path.join(tmpDir, 'dir1');
    const dir2 = path.join(tmpDir, 'dir2');

    await ensureDirs([dir1, dir2]);

    const stat1 = await fs.stat(dir1);
    const stat2 = await fs.stat(dir2);
    expect(stat1.isDirectory()).toBe(true);
    expect(stat2.isDirectory()).toBe(true);
  });

  it('does not throw if directories already exist', async () => {
    const dir1 = path.join(tmpDir, 'existing');
    await fs.mkdir(dir1);

    await expect(ensureDirs([dir1])).resolves.not.toThrow();
  });
});

describe('getDirectorySize', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dirsize-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns 0 for an empty directory', async () => {
    const size = await getDirectorySize(tmpDir);
    expect(size).toBe(0);
  });

  it('calculates size of files in a directory', async () => {
    const content = 'hello world'; // 11 bytes
    await fs.writeFile(path.join(tmpDir, 'file.txt'), content);

    const size = await getDirectorySize(tmpDir);
    expect(size).toBe(11);
  });

  it('calculates size recursively', async () => {
    const subDir = path.join(tmpDir, 'sub');
    await fs.mkdir(subDir);
    await fs.writeFile(path.join(tmpDir, 'a.txt'), 'aaaa'); // 4 bytes
    await fs.writeFile(path.join(subDir, 'b.txt'), 'bb');   // 2 bytes

    const size = await getDirectorySize(tmpDir);
    expect(size).toBe(6);
  });

  it('skips symbolic links', async () => {
    await fs.writeFile(path.join(tmpDir, 'real.txt'), 'data'); // 4 bytes
    await fs.symlink(
      path.join(tmpDir, 'real.txt'),
      path.join(tmpDir, 'link.txt')
    );

    const size = await getDirectorySize(tmpDir);
    expect(size).toBe(4);
  });

  it('returns 0 for a non-existent directory', async () => {
    const size = await getDirectorySize(path.join(tmpDir, 'nonexistent'));
    expect(size).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:unit -- --testPathPattern=fileUtils`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/utils/fileUtils.test.js
git commit -m "test: add unit tests for fileUtils"
```

---

### Task 4: Unit tests for auth middleware

**Files:**
- Create: `tests/unit/middleware/auth.test.js`
- Test target: `src/middleware/auth.js`

- [ ] **Step 1: Write tests**

Create `tests/unit/middleware/auth.test.js`:

```js
const authMiddleware = require('../../../src/middleware/auth');

function createMockReqRes(options = {}) {
  const req = {
    path: options.path || '/execute',
    headers: options.headers || {},
    app: {
      get: jest.fn((key) => {
        if (key === 'secretKey') return options.secretKey ?? 'test-secret';
        return undefined;
      }),
    },
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const next = jest.fn();

  return { req, res, next };
}

describe('authMiddleware', () => {
  it('skips auth for /health endpoint', () => {
    const { req, res, next } = createMockReqRes({ path: '/health' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips auth when no SECRET_KEY is configured', () => {
    const { req, res, next } = createMockReqRes({ secretKey: '' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', () => {
    const { req, res, next } = createMockReqRes({ secretKey: 'secret' });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', () => {
    const { req, res, next } = createMockReqRes({
      secretKey: 'secret',
      headers: { authorization: 'Basic abc' },
    });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when token does not match', () => {
    const { req, res, next } = createMockReqRes({
      secretKey: 'secret',
      headers: { authorization: 'Bearer wrong-token' },
    });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid authentication token',
    });
  });

  it('calls next() when token matches', () => {
    const { req, res, next } = createMockReqRes({
      secretKey: 'secret',
      headers: { authorization: 'Bearer secret' },
    });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:unit -- --testPathPattern=auth`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/middleware/auth.test.js
git commit -m "test: add unit tests for auth middleware"
```

---

## Chunk 2: Service Unit Tests

### Task 5: Unit tests for DependencyService (extraction and checking)

**Files:**
- Create: `tests/unit/services/dependencyService.test.js`
- Test target: `src/services/dependencyService.js`

- [ ] **Step 1: Write tests for extraction, base package name, native module check, and missing deps**

Create `tests/unit/services/dependencyService.test.js`:

```js
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const DependencyService = require('../../../src/services/dependencyService');

describe('DependencyService', () => {
  let service;
  const mockCacheService = {
    cleanupCache: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    service = new DependencyService(mockCacheService, 'update');
    jest.clearAllMocks();
  });

  describe('extractDependencies', () => {
    it('extracts require() dependencies', () => {
      const code = `
        const axios = require('axios');
        const lodash = require('lodash');
      `;
      const deps = service.extractDependencies(code);
      expect(deps).toEqual({ axios: 'latest', lodash: 'latest' });
    });

    it('extracts import dependencies', () => {
      const code = `
        import axios from 'axios';
        import { get } from 'lodash';
      `;
      const deps = service.extractDependencies(code);
      expect(deps).toEqual({ axios: 'latest', lodash: 'latest' });
    });

    it('extracts scoped packages', () => {
      const code = `const core = require('@babel/core');`;
      const deps = service.extractDependencies(code);
      expect(deps).toEqual({ '@babel/core': 'latest' });
    });

    it('excludes native Node.js modules', () => {
      const code = `
        const fs = require('fs');
        const path = require('path');
        const axios = require('axios');
        const crypto = require('crypto');
      `;
      const deps = service.extractDependencies(code);
      expect(deps).toEqual({ axios: 'latest' });
    });

    it('returns empty object for code with no dependencies', () => {
      const code = `module.exports = function(items) { return items; }`;
      const deps = service.extractDependencies(code);
      expect(deps).toEqual({});
    });

    it('handles mixed require and import', () => {
      const code = `
        const axios = require('axios');
        import cheerio from 'cheerio';
      `;
      const deps = service.extractDependencies(code);
      expect(deps).toEqual({ axios: 'latest', cheerio: 'latest' });
    });

    it('handles import with destructuring', () => {
      const code = `import { map, filter } from 'lodash';`;
      const deps = service.extractDependencies(code);
      expect(deps).toEqual({ lodash: 'latest' });
    });

    it('handles import * as syntax', () => {
      const code = `import * as R from 'ramda';`;
      const deps = service.extractDependencies(code);
      expect(deps).toEqual({ ramda: 'latest' });
    });
  });

  describe('extractBasePackageName', () => {
    it('returns package name without version', () => {
      expect(service.extractBasePackageName('axios@1.0.0')).toBe('axios');
    });

    it('returns scoped package name without version', () => {
      expect(service.extractBasePackageName('@babel/core@7.0.0')).toBe('@babel/core');
    });

    it('returns plain name as-is', () => {
      expect(service.extractBasePackageName('lodash')).toBe('lodash');
    });

    it('returns scoped name as-is', () => {
      expect(service.extractBasePackageName('@scope/pkg')).toBe('@scope/pkg');
    });
  });

  describe('isNativeModule', () => {
    it('returns true for native modules', () => {
      expect(service.isNativeModule('fs')).toBe(true);
      expect(service.isNativeModule('path')).toBe(true);
      expect(service.isNativeModule('crypto')).toBe(true);
      expect(service.isNativeModule('http')).toBe(true);
    });

    it('returns false for npm packages', () => {
      expect(service.isNativeModule('axios')).toBe(false);
      expect(service.isNativeModule('lodash')).toBe(false);
      expect(service.isNativeModule('@babel/core')).toBe(false);
    });
  });

  describe('checkForMissingDependencies', () => {
    let tmpDir;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dep-test-'));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('returns empty array when all deps are present', async () => {
      const pkgDir = path.join(tmpDir, 'axios');
      await fs.mkdir(pkgDir, { recursive: true });
      await fs.writeFile(path.join(pkgDir, 'package.json'), '{}');

      const missing = await service.checkForMissingDependencies(tmpDir, { axios: 'latest' });
      expect(missing).toEqual([]);
    });

    it('returns missing packages', async () => {
      const missing = await service.checkForMissingDependencies(tmpDir, {
        axios: 'latest',
        lodash: 'latest',
      });
      expect(missing).toEqual(['axios', 'lodash']);
    });

    it('handles scoped packages correctly', async () => {
      const scopeDir = path.join(tmpDir, '@babel', 'core');
      await fs.mkdir(scopeDir, { recursive: true });
      await fs.writeFile(path.join(scopeDir, 'package.json'), '{}');

      const missing = await service.checkForMissingDependencies(tmpDir, {
        '@babel/core': 'latest',
        '@babel/parser': 'latest',
      });
      expect(missing).toEqual(['@babel/parser']);
    });
  });

  describe('installDependencies', () => {
    let tmpDir;
    let codeDir;
    let cachePath;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'install-test-'));
      codeDir = path.join(tmpDir, 'code');
      cachePath = path.join(tmpDir, 'cache', 'test-key');
      await fs.mkdir(codeDir, { recursive: true });
      await fs.mkdir(cachePath, { recursive: true });
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('returns immediately when there are no dependencies', async () => {
      const result = await service.installDependencies({}, codeDir, 'test-key', cachePath);
      expect(result).toEqual({ success: true, dependencies: {} });
    });

    it('creates symlink from cache when cache hit and all deps present', async () => {
      // Set up cached node_modules with a fake package
      const cacheModules = path.join(cachePath, 'node_modules');
      const pkgDir = path.join(cacheModules, 'lodash');
      await fs.mkdir(pkgDir, { recursive: true });
      await fs.writeFile(path.join(pkgDir, 'package.json'), JSON.stringify({ version: '4.17.21' }));

      const result = await service.installDependencies(
        { lodash: 'latest' },
        codeDir,
        'test-key',
        cachePath,
        false
      );

      expect(result.success).toBe(true);
      expect(result.dependencies.lodash).toBe('4.17.21');

      // Verify symlink was created
      const linkTarget = await fs.readlink(path.join(codeDir, 'node_modules'));
      expect(linkTarget).toBe(cacheModules);
    });
  });

  describe('readPinnedVersions / savePinnedVersions', () => {
    let tmpDir;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pinned-test-'));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('returns null when no pinned versions file exists', async () => {
      const result = await service.readPinnedVersions(tmpDir);
      expect(result).toBeNull();
    });

    it('saves and reads pinned versions', async () => {
      const versions = { lodash: '4.17.21', axios: '1.6.0' };
      await service.savePinnedVersions(tmpDir, versions);

      const result = await service.readPinnedVersions(tmpDir);
      expect(result).toEqual(versions);
    });

    it('filters out unknown versions when saving', async () => {
      const versions = { lodash: '4.17.21', axios: 'unknown' };
      await service.savePinnedVersions(tmpDir, versions);

      const result = await service.readPinnedVersions(tmpDir);
      expect(result).toEqual({ lodash: '4.17.21' });
    });
  });

  describe('getInstalledVersions', () => {
    let tmpDir;

    beforeEach(async () => {
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'versions-test-'));
    });

    afterEach(async () => {
      await fs.rm(tmpDir, { recursive: true, force: true });
    });

    it('reads version from node_modules package.json', async () => {
      const pkgDir = path.join(tmpDir, 'node_modules', 'lodash');
      await fs.mkdir(pkgDir, { recursive: true });
      await fs.writeFile(path.join(pkgDir, 'package.json'), JSON.stringify({ version: '4.17.21' }));

      const versions = await service.getInstalledVersions(tmpDir, { lodash: 'latest' });
      expect(versions).toEqual({ lodash: '4.17.21' });
    });

    it('returns unknown for missing packages', async () => {
      await fs.mkdir(path.join(tmpDir, 'node_modules'), { recursive: true });
      const versions = await service.getInstalledVersions(tmpDir, { axios: 'latest' });
      expect(versions).toEqual({ axios: 'unknown' });
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:unit -- --testPathPattern=dependencyService`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/services/dependencyService.test.js
git commit -m "test: add unit tests for DependencyService"
```

---

### Task 6: Unit tests for CacheService

**Files:**
- Create: `tests/unit/services/cacheService.test.js`
- Test target: `src/services/cacheService.js`

- [ ] **Step 1: Write tests**

Create `tests/unit/services/cacheService.test.js`:

```js
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const CacheService = require('../../../src/services/cacheService');

describe('CacheService', () => {
  let tmpDir;
  let service;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-test-'));
    service = new CacheService(tmpDir, 1024 * 1024); // 1MB limit
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('getCacheEntries', () => {
    it('returns empty array for empty cache directory', async () => {
      const entries = await service.getCacheEntries();
      expect(entries).toEqual([]);
    });

    it('returns cache entry info for each directory', async () => {
      const entryDir = path.join(tmpDir, 'test-key');
      await fs.mkdir(entryDir);
      await fs.writeFile(path.join(entryDir, 'file.txt'), 'data');

      const entries = await service.getCacheEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].key).toBe('test-key');
      expect(entries[0].size).toBe(4);
      expect(entries[0]).toHaveProperty('lastModified');
    });

    it('ignores files (only returns directories)', async () => {
      await fs.writeFile(path.join(tmpDir, 'not-a-dir'), 'data');
      const entryDir = path.join(tmpDir, 'a-dir');
      await fs.mkdir(entryDir);

      const entries = await service.getCacheEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].key).toBe('a-dir');
    });

    it('returns empty array if cache directory does not exist', async () => {
      const badService = new CacheService('/nonexistent/path', 1024);
      const entries = await badService.getCacheEntries();
      expect(entries).toEqual([]);
    });
  });

  describe('getCacheEntryInfo', () => {
    it('returns exists: true for existing cache entry', async () => {
      const entryDir = path.join(tmpDir, 'my-key');
      await fs.mkdir(entryDir);
      await fs.writeFile(path.join(entryDir, 'file.txt'), 'hello');

      const info = await service.getCacheEntryInfo('my-key');
      expect(info.exists).toBe(true);
      expect(info.key).toBe('my-key');
      expect(info.size).toBe(5);
    });

    it('returns exists: false for non-existing cache entry', async () => {
      const info = await service.getCacheEntryInfo('nonexistent');
      expect(info.exists).toBe(false);
      expect(info.size).toBe(0);
    });
  });

  describe('cleanupCache', () => {
    it('does nothing when cache is under the limit', async () => {
      const entryDir = path.join(tmpDir, 'small-entry');
      await fs.mkdir(entryDir);
      await fs.writeFile(path.join(entryDir, 'file.txt'), 'x');

      await service.cleanupCache();

      const entries = await service.getCacheEntries();
      expect(entries).toHaveLength(1);
    });

    it('removes oldest entries when cache exceeds limit', async () => {
      // Set a very small limit
      service.cacheSizeLimit = 10; // 10 bytes

      // Create two entries with deterministic timestamps using utimes
      const oldDir = path.join(tmpDir, 'old-entry');
      await fs.mkdir(oldDir);
      await fs.writeFile(path.join(oldDir, 'file.txt'), 'x'.repeat(8));
      // Set old mtime (1 hour ago)
      const oldTime = new Date(Date.now() - 3600000);
      await fs.utimes(oldDir, oldTime, oldTime);

      const newDir = path.join(tmpDir, 'new-entry');
      await fs.mkdir(newDir);
      await fs.writeFile(path.join(newDir, 'file.txt'), 'y'.repeat(8));
      // Set recent mtime
      const newTime = new Date();
      await fs.utimes(newDir, newTime, newTime);

      await service.cleanupCache();

      // The old entry should have been removed
      const entries = await service.getCacheEntries();
      const keys = entries.map(e => e.key);
      expect(keys).not.toContain('old-entry');
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:unit -- --testPathPattern=cacheService`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/services/cacheService.test.js
git commit -m "test: add unit tests for CacheService"
```

---

### Task 7: Unit tests for ExecutionService

**Files:**
- Create: `tests/unit/services/executionService.test.js`
- Test target: `src/services/executionService.js`

- [ ] **Step 1: Write tests**

Create `tests/unit/services/executionService.test.js`:

```js
const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const ExecutionService = require('../../../src/services/executionService');

describe('ExecutionService', () => {
  let tmpDir;
  let service;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'exec-test-'));
    service = new ExecutionService(tmpDir, 5000, 5);
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('createExecutionDir', () => {
    it('creates a directory with exec- prefix', async () => {
      const dir = await service.createExecutionDir();
      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
      expect(path.basename(dir)).toMatch(/^exec-\d+-[a-z0-9]+$/);
    });

    it('creates unique directories on each call', async () => {
      const dir1 = await service.createExecutionDir();
      const dir2 = await service.createExecutionDir();
      expect(dir1).not.toBe(dir2);
    });
  });

  describe('pruneOldExecutionDirs', () => {
    it('does nothing when maxExecutionDirs is 0', async () => {
      service.maxExecutionDirs = 0;
      await fs.mkdir(path.join(tmpDir, 'exec-1000-abc'));
      await service.pruneOldExecutionDirs();
      const entries = await fs.readdir(tmpDir);
      expect(entries).toHaveLength(1);
    });

    it('removes oldest dirs when exceeding max', async () => {
      service.maxExecutionDirs = 2;
      await fs.mkdir(path.join(tmpDir, 'exec-1000-aaa'));
      await fs.mkdir(path.join(tmpDir, 'exec-2000-bbb'));
      await fs.mkdir(path.join(tmpDir, 'exec-3000-ccc'));

      await service.pruneOldExecutionDirs();

      const entries = await fs.readdir(tmpDir);
      expect(entries).toHaveLength(2);
      expect(entries).toContain('exec-2000-bbb');
      expect(entries).toContain('exec-3000-ccc');
    });

    it('does nothing when under the limit', async () => {
      service.maxExecutionDirs = 5;
      await fs.mkdir(path.join(tmpDir, 'exec-1000-aaa'));
      await fs.mkdir(path.join(tmpDir, 'exec-2000-bbb'));

      await service.pruneOldExecutionDirs();

      const entries = await fs.readdir(tmpDir);
      expect(entries).toHaveLength(2);
    });
  });

  describe('executeCode', () => {
    it('executes simple code that returns a value', async () => {
      const execDir = await service.createExecutionDir();
      const code = `module.exports = function(items) { return items.map(i => i * 2); }`;
      const items = [1, 2, 3];

      const result = await service.executeCode(code, items, execDir, 5000);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([2, 4, 6]);
    });

    it('executes async code', async () => {
      const execDir = await service.createExecutionDir();
      const code = `module.exports = async function(items) {
        return items.map(i => i + 1);
      }`;
      const items = [10, 20];

      const result = await service.executeCode(code, items, execDir, 5000);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([11, 21]);
    });

    it('captures console output', async () => {
      const execDir = await service.createExecutionDir();
      const code = `module.exports = function(items) {
        console.log('hello');
        console.warn('warning');
        return items;
      }`;

      const result = await service.executeCode(code, [], execDir, 5000);
      expect(result.success).toBe(true);
      expect(result.console).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'log', message: 'hello' }),
          expect.objectContaining({ type: 'warn', message: 'warning' }),
        ])
      );
    });

    it('rejects when code throws an error', async () => {
      const execDir = await service.createExecutionDir();
      const code = `module.exports = function() { throw new Error('test error'); }`;

      await expect(
        service.executeCode(code, [], execDir, 5000)
      ).rejects.toMatchObject({
        success: false,
        error: 'test error',
      });
    });

    it('rejects when code does not export a function', async () => {
      const execDir = await service.createExecutionDir();
      const code = `module.exports = 'not a function';`;

      await expect(
        service.executeCode(code, [], execDir, 5000)
      ).rejects.toMatchObject({
        success: false,
        error: 'The code must export a function',
      });
    });

    it('rejects on timeout', async () => {
      const execDir = await service.createExecutionDir();
      const code = `module.exports = function() {
        return new Promise(() => {}); // never resolves
      }`;

      await expect(
        service.executeCode(code, [], execDir, 1000)
      ).rejects.toBeDefined();
    }, 10000);
  });

  describe('cleanupExecutionDir', () => {
    it('does not delete dir when maxExecutionDirs > 0', async () => {
      const dir = await service.createExecutionDir();
      await service.cleanupExecutionDir(dir);
      const stat = await fs.stat(dir);
      expect(stat.isDirectory()).toBe(true);
    });

    it('deletes dir when maxExecutionDirs <= 0', async () => {
      service.maxExecutionDirs = 0;
      const dir = await service.createExecutionDir();
      await service.cleanupExecutionDir(dir);
      await expect(fs.stat(dir)).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:unit -- --testPathPattern=executionService`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/services/executionService.test.js
git commit -m "test: add unit tests for ExecutionService"
```

---

### Task 8: Unit tests for ExecutionController (helpers + executeCode with mocked services)

**Files:**
- Create: `tests/unit/controllers/executionController.test.js`
- Test target: `src/controllers/executionController.js`

- [ ] **Step 1: Write tests for formatBytes, filterErrorStack, healthCheck, verifyAuth**

Create `tests/unit/controllers/executionController.test.js`:

```js
const ExecutionController = require('../../../src/controllers/executionController');

describe('ExecutionController', () => {
  let controller;
  let mockDependencyService;
  let mockExecutionService;
  let mockCacheService;

  beforeEach(() => {
    mockDependencyService = {
      extractDependencies: jest.fn().mockReturnValue({}),
      installDependencies: jest.fn().mockResolvedValue({ success: true, dependencies: {} }),
    };
    mockExecutionService = {
      createExecutionDir: jest.fn().mockResolvedValue('/tmp/exec-123'),
      executeCode: jest.fn().mockResolvedValue({ success: true, data: [], console: [] }),
      cleanupExecutionDir: jest.fn().mockResolvedValue(undefined),
    };
    mockCacheService = {
      getCacheEntries: jest.fn().mockResolvedValue([]),
      getCacheEntryInfo: jest.fn().mockResolvedValue({ exists: false, size: 0 }),
      cleanupCache: jest.fn().mockResolvedValue(undefined),
    };

    controller = new ExecutionController(
      mockDependencyService,
      mockExecutionService,
      mockCacheService,
      '/tmp/cache'
    );
  });

  describe('formatBytes', () => {
    it('formats 0 bytes', () => {
      expect(controller.formatBytes(0)).toBe('0 Bytes');
    });

    it('formats bytes', () => {
      expect(controller.formatBytes(500)).toBe('500 Bytes');
    });

    it('formats kilobytes', () => {
      expect(controller.formatBytes(1024)).toBe('1 KB');
    });

    it('formats megabytes', () => {
      expect(controller.formatBytes(1048576)).toBe('1 MB');
    });

    it('formats gigabytes', () => {
      expect(controller.formatBytes(1073741824)).toBe('1 GB');
    });

    it('respects decimal places parameter', () => {
      expect(controller.formatBytes(1536, 1)).toBe('1.5 KB');
    });
  });

  describe('filterErrorStack', () => {
    it('returns message for error without stack', () => {
      expect(controller.filterErrorStack({})).toBe('Error: No stack trace available');
    });

    it('preserves error message (first line)', () => {
      const error = { stack: 'Error: something failed\n    at foo.js:1:1' };
      const filtered = controller.filterErrorStack(error);
      expect(filtered).toContain('Error: something failed');
    });

    it('removes server paths from execution.js references', () => {
      const error = {
        stack: 'Error: fail\n    at Object.<anonymous> (/server/path/executions/exec-123/execution.js:5:10)',
      };
      const filtered = controller.filterErrorStack(error);
      expect(filtered).not.toContain('/server/path/executions/exec-123/');
      expect(filtered).toContain('execution.js:5:10');
    });

    it('removes server paths from node_modules references', () => {
      const error = {
        stack: 'Error: fail\n    at something (/server/path/node_modules/axios/index.js:1:1)',
      };
      const filtered = controller.filterErrorStack(error);
      expect(filtered).not.toContain('/server/path');
      expect(filtered).toContain('/node_modules/axios/index.js');
    });

    it('replaces wrapper.js lines with [code]', () => {
      const error = {
        stack: 'Error: fail\n    at Object.<anonymous> (wrapper.js:50:5)',
      };
      const filtered = controller.filterErrorStack(error);
      expect(filtered).toContain('at [code]');
    });
  });

  describe('healthCheck', () => {
    it('returns status ok with config info', async () => {
      const req = {
        app: {
          get: jest.fn((key) => {
            if (key === 'secretKey') return 'my-secret';
            if (key === 'defaultTimeout') return 30000;
          }),
        },
      };
      const res = { json: jest.fn() };

      await controller.healthCheck(req, res);

      expect(res.json).toHaveBeenCalledWith({
        status: 'ok',
        version: '1.0.0',
        auth: 'enabled',
        defaultTimeout: '30000ms',
      });
    });

    it('shows auth disabled when no secret key', async () => {
      const req = {
        app: {
          get: jest.fn((key) => {
            if (key === 'secretKey') return '';
            if (key === 'defaultTimeout') return 60000;
          }),
        },
      };
      const res = { json: jest.fn() };

      await controller.healthCheck(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ auth: 'disabled' })
      );
    });
  });

  describe('verifyAuth', () => {
    it('returns authentication successful', async () => {
      const req = {};
      const res = { json: jest.fn() };

      await controller.verifyAuth(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Authentication successful',
        authenticated: true,
      });
    });
  });

  describe('executeCode', () => {
    function createMockReqRes(body = {}) {
      return {
        req: { body },
        res: {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        },
      };
    }

    it('returns 400 when code is missing', async () => {
      const { req, res } = createMockReqRes({ cacheKey: 'key' });
      await controller.executeCode(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Code is required' })
      );
    });

    it('returns 400 when cacheKey is missing', async () => {
      const { req, res } = createMockReqRes({ code: 'module.exports = () => 1' });
      await controller.executeCode(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.stringContaining('Cache key') })
      );
    });

    it('calls services in correct order and returns result', async () => {
      mockExecutionService.executeCode.mockResolvedValue({
        success: true,
        data: [2, 4],
        console: [],
      });

      const { req, res } = createMockReqRes({
        code: 'module.exports = (i) => i.map(x => x*2)',
        items: [1, 2],
        cacheKey: 'test-key',
      });

      await controller.executeCode(req, res);

      expect(mockDependencyService.extractDependencies).toHaveBeenCalled();
      expect(mockExecutionService.createExecutionDir).toHaveBeenCalled();
      expect(mockDependencyService.installDependencies).toHaveBeenCalled();
      expect(mockExecutionService.executeCode).toHaveBeenCalled();
      expect(mockExecutionService.cleanupExecutionDir).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, data: [2, 4] })
      );
    });

    it('cleans up execution dir on error and returns error response', async () => {
      const executionError = {
        success: false,
        error: 'execution failed',
        console: [{ type: 'error', message: 'runtime error' }],
        stack: 'Error: execution failed\n    at execution.js:1:1',
      };
      mockExecutionService.executeCode.mockRejectedValue(executionError);

      const { req, res } = createMockReqRes({
        code: 'module.exports = () => { throw new Error("fail") }',
        cacheKey: 'err-key',
      });

      await controller.executeCode(req, res);

      expect(mockExecutionService.cleanupExecutionDir).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    it('uses first console message as error when error.error is empty', async () => {
      const executionError = {
        success: false,
        error: '',
        console: [{ type: 'error', message: 'console error msg' }],
        stack: 'Error\n    at execution.js:1:1',
      };
      mockExecutionService.executeCode.mockRejectedValue(executionError);

      const { req, res } = createMockReqRes({
        code: 'code',
        cacheKey: 'key',
      });

      await controller.executeCode(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'console error msg' })
      );
    });

    it('includes debug info when debug option is true', async () => {
      mockExecutionService.executeCode.mockResolvedValue({
        success: true,
        data: [],
        console: [],
      });
      mockCacheService.getCacheEntryInfo.mockResolvedValue({ exists: true, size: 1024 });

      const { req, res } = createMockReqRes({
        code: 'module.exports = () => []',
        cacheKey: 'debug-key',
        options: { debug: true },
      });

      await controller.executeCode(req, res);

      const responseBody = res.json.mock.calls[0][0];
      expect(responseBody.debug).toBeDefined();
      expect(responseBody.debug.server).toHaveProperty('nodeVersion');
      expect(responseBody.debug.cache).toHaveProperty('cacheKey', 'debug-key');
      expect(responseBody.debug.execution).toHaveProperty('totalResponseTimeMs');
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:unit -- --testPathPattern=executionController`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add tests/unit/controllers/executionController.test.js
git commit -m "test: add unit tests for ExecutionController"
```

---

## Chunk 3: E2E Tests

### Task 9: E2E test setup helper

**Files:**
- Create: `tests/e2e/setup.js`

- [ ] **Step 1: Create server setup helper with require.cache clearing**

Create `tests/e2e/setup.js`:

```js
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

/**
 * Clear require.cache for all project source modules.
 * This ensures each startServer() call gets fresh module instances.
 */
function clearProjectModuleCache() {
  const projectRoot = path.resolve(__dirname, '..', '..');
  Object.keys(require.cache).forEach((key) => {
    if (key.startsWith(path.join(projectRoot, 'src'))) {
      delete require.cache[key];
    }
  });
}

/**
 * Start a real CodeHarbor-Executor server on a random port.
 * Returns { baseUrl, server, tmpDir, cleanup }.
 */
async function startServer(envOverrides = {}) {
  // Create temp dirs for isolation
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeharbor-e2e-'));
  const executionDir = path.join(tmpDir, 'executions');
  const cacheDir = path.join(tmpDir, 'cache');
  await fs.mkdir(executionDir, { recursive: true });
  await fs.mkdir(cacheDir, { recursive: true });

  // Set env vars before requiring the app modules
  process.env.SECRET_KEY = envOverrides.SECRET_KEY ?? 'e2e-test-secret';
  process.env.DEFAULT_TIMEOUT = envOverrides.DEFAULT_TIMEOUT ?? '10000';
  process.env.CACHE_SIZE_LIMIT = envOverrides.CACHE_SIZE_LIMIT ?? '100MB';
  process.env.EXECUTIONS_DATA_PRUNE_MAX_COUNT = envOverrides.EXECUTIONS_DATA_PRUNE_MAX_COUNT ?? '50';
  process.env.DEPENDENCY_VERSION_STRATEGY = envOverrides.DEPENDENCY_VERSION_STRATEGY ?? 'update';

  // Clear cached modules to get fresh instances
  clearProjectModuleCache();

  // Require modules fresh
  const express = require('express');
  const bodyParser = require('body-parser');
  const { parseFileSize } = require('../../src/utils/parseUtils');
  const CacheService = require('../../src/services/cacheService');
  const DependencyService = require('../../src/services/dependencyService');
  const ExecutionService = require('../../src/services/executionService');
  const ExecutionController = require('../../src/controllers/executionController');
  const authMiddleware = require('../../src/middleware/auth');
  const setupRoutes = require('../../src/routes');

  const app = express();
  app.set('secretKey', process.env.SECRET_KEY);
  app.set('defaultTimeout', parseInt(process.env.DEFAULT_TIMEOUT, 10));
  app.set('cacheSizeLimit', parseFileSize(process.env.CACHE_SIZE_LIMIT));

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(authMiddleware);

  const cacheService = new CacheService(cacheDir, parseFileSize(process.env.CACHE_SIZE_LIMIT));
  const dependencyService = new DependencyService(cacheService, process.env.DEPENDENCY_VERSION_STRATEGY);
  const executionService = new ExecutionService(executionDir, parseInt(process.env.DEFAULT_TIMEOUT, 10), parseInt(process.env.EXECUTIONS_DATA_PRUNE_MAX_COUNT, 10));
  const executionController = new ExecutionController(dependencyService, executionService, cacheService, cacheDir);

  const router = setupRoutes(app, executionController);
  app.use('/', router);

  // Listen on port 0 to get a random available port
  const server = await new Promise((resolve) => {
    const srv = app.listen(0, () => resolve(srv));
  });

  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const cleanup = async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tmpDir, { recursive: true, force: true });
  };

  return { baseUrl, server, tmpDir, cleanup };
}

module.exports = { startServer };
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/setup.js
git commit -m "test: add E2E server setup helper"
```

---

### Task 10: E2E tests for health endpoint

**Files:**
- Create: `tests/e2e/health.e2e.test.js`

- [ ] **Step 1: Write tests**

Create `tests/e2e/health.e2e.test.js`:

```js
const { startServer } = require('./setup');

describe('GET /health', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await startServer();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('returns status ok without requiring auth', async () => {
    const res = await fetch(`${ctx.baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('1.0.0');
    expect(body.auth).toBe('enabled');
    expect(body).toHaveProperty('defaultTimeout');
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:e2e -- --testPathPattern=health`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/health.e2e.test.js
git commit -m "test: add E2E tests for health endpoint"
```

---

### Task 11: E2E tests for auth

**Files:**
- Create: `tests/e2e/auth.e2e.test.js`

- [ ] **Step 1: Write tests**

Create `tests/e2e/auth.e2e.test.js`:

```js
const { startServer } = require('./setup');

describe('Authentication E2E', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await startServer({ SECRET_KEY: 'e2e-secret' });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('GET /verify-auth', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await fetch(`${ctx.baseUrl}/verify-auth`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('returns 403 with wrong token', async () => {
      const res = await fetch(`${ctx.baseUrl}/verify-auth`, {
        headers: { Authorization: 'Bearer wrong' },
      });
      expect(res.status).toBe(403);
    });

    it('returns success with correct token', async () => {
      const res = await fetch(`${ctx.baseUrl}/verify-auth`, {
        headers: { Authorization: 'Bearer e2e-secret' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.authenticated).toBe(true);
    });
  });

  describe('POST /execute requires auth', () => {
    it('returns 401 without token', async () => {
      const res = await fetch(`${ctx.baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'module.exports = () => 1', cacheKey: 'test' }),
      });
      expect(res.status).toBe(401);
    });
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:e2e -- --testPathPattern=auth`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/auth.e2e.test.js
git commit -m "test: add E2E tests for authentication"
```

---

### Task 12: E2E tests for code execution — validation and simple execution

**Files:**
- Create: `tests/e2e/execute.e2e.test.js`

- [ ] **Step 1: Write tests for validation, simple execution, and console capture**

Create `tests/e2e/execute.e2e.test.js`:

```js
const { startServer } = require('./setup');

describe('POST /execute E2E', () => {
  let ctx;
  const SECRET = 'exec-e2e-secret';

  const exec = async (body) => {
    const res = await fetch(`${ctx.baseUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SECRET}`,
      },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  beforeAll(async () => {
    ctx = await startServer({ SECRET_KEY: SECRET });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('validation', () => {
    it('returns 400 when code is missing', async () => {
      const { status, body } = await exec({ cacheKey: 'k' });
      expect(status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Code is required');
    });

    it('returns 400 when cacheKey is missing', async () => {
      const { status, body } = await exec({ code: 'module.exports = () => 1' });
      expect(status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('Cache key is required');
    });
  });

  describe('simple execution (no npm dependencies)', () => {
    it('executes code that returns items doubled', async () => {
      const { status, body } = await exec({
        code: 'module.exports = function(items) { return items.map(i => i * 2); }',
        items: [1, 2, 3],
        cacheKey: 'simple-double',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([2, 4, 6]);
    });

    it('executes async code', async () => {
      const { status, body } = await exec({
        code: `module.exports = async function(items) {
          return items.map(i => ({ value: i }));
        }`,
        items: [10, 20],
        cacheKey: 'simple-async',
      });

      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toEqual([{ value: 10 }, { value: 20 }]);
    });

    it('returns empty items by default', async () => {
      const { body } = await exec({
        code: 'module.exports = function(items) { return items; }',
        cacheKey: 'simple-empty',
      });
      expect(body.success).toBe(true);
      expect(body.data).toEqual([]);
    });
  });

  describe('console capture', () => {
    it('captures console.log, console.warn, and console.error', async () => {
      const { body } = await exec({
        code: `module.exports = function(items) {
          console.log('log message');
          console.warn('warn message');
          console.error('error message');
          return items;
        }`,
        items: [],
        cacheKey: 'console-capture',
      });

      expect(body.success).toBe(true);
      expect(body.console).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'log', message: 'log message' }),
          expect.objectContaining({ type: 'warn', message: 'warn message' }),
          expect.objectContaining({ type: 'error', message: 'error message' }),
        ])
      );
    });
  });

  describe('error handling', () => {
    it('returns error when code throws', async () => {
      const { status, body } = await exec({
        code: `module.exports = function() { throw new Error('intentional error'); }`,
        items: [],
        cacheKey: 'error-throw',
      });

      expect(status).toBe(200); // errors return 200 with success: false
      expect(body.success).toBe(false);
      expect(body.error).toContain('intentional error');
    });

    it('returns error when code does not export a function', async () => {
      const { body } = await exec({
        code: `module.exports = 42;`,
        items: [],
        cacheKey: 'error-not-function',
      });

      expect(body.success).toBe(false);
      expect(body.error).toContain('must export a function');
    });

    it('returns error for syntax errors', async () => {
      const { body } = await exec({
        code: `module.exports = function() { const x = ; }`,
        items: [],
        cacheKey: 'error-syntax',
      });

      expect(body.success).toBe(false);
    });
  });

  describe('debug mode', () => {
    it('returns debug info when debug option is true', async () => {
      const { body } = await exec({
        code: `module.exports = function(items) { return items; }`,
        items: [1],
        cacheKey: 'debug-test',
        options: { debug: true },
      });

      expect(body.success).toBe(true);
      expect(body.debug).toBeDefined();
      expect(body.debug.server).toHaveProperty('nodeVersion');
      expect(body.debug.cache).toHaveProperty('cacheKey', 'debug-test');
      expect(body.debug.execution).toHaveProperty('totalResponseTimeMs');
    });

    it('does not return debug info when debug is false', async () => {
      const { body } = await exec({
        code: `module.exports = function(items) { return items; }`,
        items: [],
        cacheKey: 'no-debug-test',
      });

      expect(body.success).toBe(true);
      expect(body.debug).toBeUndefined();
    });
  });

  describe('timeout', () => {
    it('terminates execution that exceeds timeout', async () => {
      const { body } = await exec({
        code: `module.exports = function() {
          return new Promise(() => {}); // never resolves
        }`,
        items: [],
        cacheKey: 'timeout-test',
        options: { timeout: 2000 },
      });

      expect(body.success).toBe(false);
    }, 15000);
  });

  describe('npm dependency execution', () => {
    it('installs and uses an npm package (lodash)', async () => {
      const { body } = await exec({
        code: `
          const _ = require('lodash');
          module.exports = function(items) {
            return _.uniq(items);
          }
        `,
        items: [1, 2, 2, 3, 3, 3],
        cacheKey: 'npm-lodash-test',
      });

      expect(body.success).toBe(true);
      expect(body.data).toEqual([1, 2, 3]);
    }, 30000);

    it('uses cache on second execution with same cacheKey', async () => {
      const cacheKey = 'npm-cache-reuse';
      const payload = {
        code: `
          const _ = require('lodash');
          module.exports = function(items) { return _.chunk(items, 2); }
        `,
        items: [1, 2, 3, 4],
        cacheKey,
        options: { debug: true },
      };

      // First call — installs deps
      const first = await exec(payload);
      expect(first.body.success).toBe(true);

      // Second call — should use cache
      const second = await exec(payload);
      expect(second.body.success).toBe(true);
      expect(second.body.data).toEqual([[1, 2], [3, 4]]);
      expect(second.body.debug.cache.usedCache).toBe(true);
    }, 30000);
  });

  describe('forceUpdate', () => {
    it('reinstalls dependencies when forceUpdate is true', async () => {
      const cacheKey = 'force-update-test';
      const payload = {
        code: `
          const _ = require('lodash');
          module.exports = function(items) { return _.compact(items); }
        `,
        items: [0, 1, false, 2, '', 3],
        cacheKey,
        options: { debug: true },
      };

      // First call
      await exec(payload);

      // Second call with forceUpdate
      const result = await exec({
        ...payload,
        options: { debug: true, forceUpdate: true },
      });

      expect(result.body.success).toBe(true);
      expect(result.body.data).toEqual([1, 2, 3]);
      expect(result.body.debug.cache.usedCache).toBe(false);
    }, 30000);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `pnpm test:e2e -- --testPathPattern=execute`
Expected: All tests PASS (npm-dependent tests may take 10-20s each)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/execute.e2e.test.js
git commit -m "test: add E2E tests for code execution endpoint"
```

---

## Chunk 4: Coverage verification and .gitignore

### Task 13: Run full test suite with coverage

- [ ] **Step 1: Run unit tests with coverage**

Run: `pnpm test:coverage`
Expected: Coverage report printed to terminal and saved to `coverage/` directory.

- [ ] **Step 2: Run full suite (unit + e2e)**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Add coverage to .gitignore**

Add `coverage/` to `.gitignore` if not already present.

- [ ] **Step 4: Final commit**

```bash
git add .gitignore
git commit -m "chore: add coverage directory to .gitignore"
```
