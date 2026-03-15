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
