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
