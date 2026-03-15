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
        error: expect.stringContaining('The code must export a function'),
      });
    });

    it('collects debug info when collectDebugInfo is true', async () => {
      const execDir = await service.createExecutionDir();
      const code = `module.exports = function(items) { return items; }`;

      const result = await service.executeCode(code, [1, 2], execDir, 5000, true);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([1, 2]);
      expect(result.debug).toBeDefined();
      expect(result.debug).toHaveProperty('executionTimeMs');
      expect(typeof result.debug.executionTimeMs).toBe('number');
    });

    it('includes debug info in error rejection when collectDebugInfo is true', async () => {
      const execDir = await service.createExecutionDir();
      const code = `module.exports = function() { throw new Error('debug error'); }`;

      try {
        await service.executeCode(code, [], execDir, 5000, true);
        expect.unreachable('should have rejected');
      } catch (err) {
        expect(err.success).toBe(false);
        expect(err.error).toContain('debug error');
        expect(err.debug).toBeDefined();
        expect(err.debug).toHaveProperty('executionTimeMs');
      }
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
