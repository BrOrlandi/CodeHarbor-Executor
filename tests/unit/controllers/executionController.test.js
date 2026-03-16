const ExecutionController = require('../../../src/controllers/executionController');

describe('ExecutionController', () => {
  let controller;
  let mockDependencyService;
  let mockExecutionService;
  let mockCacheService;

  beforeEach(() => {
    mockDependencyService = {
      extractDependencies: vi.fn().mockReturnValue({}),
      installDependencies: vi.fn().mockResolvedValue({ success: true, dependencies: {} }),
    };
    mockExecutionService = {
      createExecutionDir: vi.fn().mockResolvedValue('/tmp/exec-123'),
      executeCode: vi.fn().mockResolvedValue({ success: true, data: [], console: [] }),
      cleanupExecutionDir: vi.fn().mockResolvedValue(undefined),
    };
    mockCacheService = {
      getCacheEntries: vi.fn().mockResolvedValue([]),
      getCacheEntryInfo: vi.fn().mockResolvedValue({ exists: false, size: 0 }),
      cleanupCache: vi.fn().mockResolvedValue(undefined),
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
          get: vi.fn((key) => {
            if (key === 'secretKey') return 'my-secret';
            if (key === 'defaultTimeout') return 30000;
          }),
        },
      };
      const res = { json: vi.fn() };

      await controller.healthCheck(req, res);

      expect(res.json).toHaveBeenCalledWith({
        status: 'ok',
        version: '2.1.0',
        auth: 'enabled',
        defaultTimeout: '30000ms',
      });
    });

    it('shows auth disabled when no secret key', async () => {
      const req = {
        app: {
          get: vi.fn((key) => {
            if (key === 'secretKey') return '';
            if (key === 'defaultTimeout') return 60000;
          }),
        },
      };
      const res = { json: vi.fn() };

      await controller.healthCheck(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ auth: 'disabled' })
      );
    });
  });

  describe('verifyAuth', () => {
    it('returns authentication successful', async () => {
      const req = {};
      const res = { json: vi.fn() };

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
          status: vi.fn().mockReturnThis(),
          json: vi.fn().mockReturnThis(),
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

    it('calculates total cache size from existing entries in debug mode', async () => {
      mockCacheService.getCacheEntries.mockResolvedValue([
        { key: 'entry-1', size: 5000 },
        { key: 'entry-2', size: 3000 },
      ]);
      mockCacheService.getCacheEntryInfo.mockResolvedValue({ exists: true, size: 2048 });
      mockExecutionService.executeCode.mockResolvedValue({
        success: true,
        data: [],
        console: [],
      });
      mockDependencyService.installDependencies.mockResolvedValue({
        success: true,
        dependencies: { lodash: '4.17.21' },
      });

      const { req, res } = createMockReqRes({
        code: 'module.exports = () => []',
        cacheKey: 'debug-cache-key',
        options: { debug: true },
      });

      await controller.executeCode(req, res);

      const debug = res.json.mock.calls[0][0].debug;
      expect(debug.cache.totalCacheSize).toBe(8000);
      expect(debug.cache.totalCacheSizeFormatted).toBe('7.81 KB');
      expect(debug.cache.currentCacheSize).toBe(2048);
      expect(debug.cache.currentCacheSizeFormatted).toBe('2 KB');
      expect(debug.cache.usedCache).toBe(true);
      expect(debug.execution.installedDependencies).toEqual({ lodash: '4.17.21' });
      expect(debug.execution.dependencyInstallTimeMs).toBeDefined();
    });

    it('sets usedCache to false when forceUpdate is true in debug mode', async () => {
      mockCacheService.getCacheEntryInfo.mockResolvedValue({ exists: true, size: 512 });
      mockExecutionService.executeCode.mockResolvedValue({
        success: true,
        data: [],
        console: [],
      });

      const { req, res } = createMockReqRes({
        code: 'module.exports = () => []',
        cacheKey: 'force-key',
        options: { debug: true, forceUpdate: true },
      });

      await controller.executeCode(req, res);

      const debug = res.json.mock.calls[0][0].debug;
      expect(debug.cache.usedCache).toBe(false);
    });

    it('merges debug info from execution result when it already has debug', async () => {
      mockExecutionService.executeCode.mockResolvedValue({
        success: true,
        data: [],
        console: [],
        debug: { executionTimeMs: 42 },
      });
      mockCacheService.getCacheEntryInfo.mockResolvedValue({ exists: false, size: 0 });

      const { req, res } = createMockReqRes({
        code: 'module.exports = () => []',
        cacheKey: 'merge-debug-key',
        options: { debug: true },
      });

      await controller.executeCode(req, res);

      const debug = res.json.mock.calls[0][0].debug;
      // Should have merged: execution result debug + controller debug
      expect(debug.server).toHaveProperty('nodeVersion');
      expect(debug.cache).toHaveProperty('cacheKey', 'merge-debug-key');
      expect(debug.execution).toHaveProperty('totalResponseTimeMs');
    });

    it('attaches debug info to error object when execution fails with debug on', async () => {
      mockCacheService.getCacheEntries.mockResolvedValue([{ key: 'e', size: 100 }]);
      mockCacheService.getCacheEntryInfo.mockResolvedValue({ exists: true, size: 100 });
      const executionError = {
        success: false,
        error: 'runtime crash',
        console: [],
        stack: 'Error: runtime crash\n    at execution.js:1:1',
      };
      mockExecutionService.executeCode.mockRejectedValue(executionError);

      const { req, res } = createMockReqRes({
        code: 'module.exports = () => { throw new Error("crash") }',
        cacheKey: 'err-debug-key',
        options: { debug: true },
      });

      await controller.executeCode(req, res);

      // Debug info is set on error.debug in catch block (line 250)
      // After that, the spread condition !error.debug is false, so debug is NOT in response
      // But error.debug itself was populated with totalResponseTimeMs
      expect(executionError.debug).toBeDefined();
      expect(executionError.debug.execution).toHaveProperty('totalResponseTimeMs');
      expect(executionError.debug.server).toHaveProperty('nodeVersion');
    });

    it('merges debug info with error.debug when error already has debug', async () => {
      const executionError = {
        success: false,
        error: 'fail',
        console: [],
        stack: 'Error: fail\n    at execution.js:1:1',
        debug: { executionTimeMs: 55 },
      };
      mockExecutionService.executeCode.mockRejectedValue(executionError);

      const { req, res } = createMockReqRes({
        code: 'module.exports = () => {}',
        cacheKey: 'err-merge-key',
        options: { debug: true },
      });

      await controller.executeCode(req, res);

      // error.debug is merged: original error debug + controller debug
      expect(executionError.debug.server).toHaveProperty('nodeVersion');
      expect(executionError.debug.execution).toHaveProperty('totalResponseTimeMs');
    });
  });
});
