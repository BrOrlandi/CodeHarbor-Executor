const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const DependencyService = require('../../../src/services/dependencyService');

describe('DependencyService', () => {
  let service;
  const mockCacheService = {
    cleanupCache: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    service = new DependencyService(mockCacheService, 'update');
    vi.clearAllMocks();
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
