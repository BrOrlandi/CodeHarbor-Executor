const DashboardController = require('../../../src/controllers/dashboardController');

describe('DashboardController', () => {
  let controller;
  let mockJobService;
  let mockCacheService;
  let mockExecutionController;

  function createMockRes() {
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      cookie: vi.fn().mockReturnThis(),
      clearCookie: vi.fn().mockReturnThis(),
    };
    return res;
  }

  beforeEach(() => {
    mockJobService = {
      createJob: vi.fn().mockReturnValue('job-123-abc'),
      updateJobStatus: vi.fn(),
      completeJob: vi.fn(),
      getJobs: vi.fn().mockReturnValue({ jobs: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
      getJob: vi.fn().mockReturnValue(null),
      getJobStats: vi.fn().mockReturnValue({ total: 0, success: 0, error: 0, avgExecutionTimeMs: 0 }),
      deleteJob: vi.fn().mockReturnValue(false),
      databaseService: {
        getDb: vi.fn().mockReturnValue({
          prepare: vi.fn().mockReturnValue({
            all: vi.fn().mockReturnValue([]),
          }),
        }),
      },
    };

    mockCacheService = {
      getCacheEntries: vi.fn().mockResolvedValue([]),
    };

    mockExecutionController = {
      executeCodeInternal: vi.fn().mockResolvedValue({
        success: true,
        data: [1, 2],
        console: [],
      }),
    };

    controller = new DashboardController(mockJobService, mockCacheService, mockExecutionController);
  });

  describe('login', () => {
    it('sets dummy cookie and succeeds when no secret key is configured', async () => {
      const req = {
        body: {},
        app: { get: vi.fn().mockReturnValue('') },
      };
      const res = createMockRes();

      await controller.login(req, res);

      expect(res.cookie).toHaveBeenCalledWith('codeharbor_session', 'no-auth', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('returns 403 for invalid secret key', async () => {
      const req = {
        body: { secretKey: 'wrong' },
        app: { get: vi.fn().mockReturnValue('correct-secret') },
      };
      const res = createMockRes();

      await controller.login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Invalid secret key' });
    });

    it('sets session cookie and succeeds for correct secret key', async () => {
      const req = {
        body: { secretKey: 'my-secret' },
        app: { get: vi.fn().mockReturnValue('my-secret') },
      };
      const res = createMockRes();

      await controller.login(req, res);

      expect(res.cookie).toHaveBeenCalledWith(
        'codeharbor_session',
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'strict',
          path: '/',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        })
      );
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('logout', () => {
    it('clears the session cookie', async () => {
      const req = {};
      const res = createMockRes();

      await controller.logout(req, res);

      expect(res.clearCookie).toHaveBeenCalledWith('codeharbor_session', { path: '/' });
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('getJobs', () => {
    it('returns paginated job list with default params', async () => {
      mockJobService.getJobs.mockReturnValue({
        jobs: [{ job_id: 'j1' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const req = { query: {} };
      const res = createMockRes();

      await controller.getJobs(req, res);

      expect(mockJobService.getJobs).toHaveBeenCalledWith({
        status: undefined,
        cacheKey: undefined,
        search: undefined,
        sortBy: undefined,
        sortOrder: undefined,
        page: 1,
        limit: 20,
      });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ total: 1 }));
    });

    it('parses page and limit from query params', async () => {
      const req = { query: { page: '3', limit: '10', status: 'error' } };
      const res = createMockRes();

      await controller.getJobs(req, res);

      expect(mockJobService.getJobs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 3, limit: 10, status: 'error' })
      );
    });

    it('returns 500 on error', async () => {
      mockJobService.getJobs.mockImplementation(() => { throw new Error('db error'); });

      const req = { query: {} };
      const res = createMockRes();

      await controller.getJobs(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'db error' });
    });
  });

  describe('getJob', () => {
    it('returns job details', async () => {
      const mockJob = { job_id: 'j1', status: 'success', code: 'code' };
      mockJobService.getJob.mockReturnValue(mockJob);

      const req = { params: { jobId: 'j1' } };
      const res = createMockRes();

      await controller.getJob(req, res);

      expect(res.json).toHaveBeenCalledWith(mockJob);
    });

    it('returns 404 when job not found', async () => {
      mockJobService.getJob.mockReturnValue(null);

      const req = { params: { jobId: 'nonexistent' } };
      const res = createMockRes();

      await controller.getJob(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Job not found' });
    });

    it('returns 500 on error', async () => {
      mockJobService.getJob.mockImplementation(() => { throw new Error('query error'); });

      const req = { params: { jobId: 'j1' } };
      const res = createMockRes();

      await controller.getJob(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getJobStats', () => {
    it('returns aggregate stats', async () => {
      const mockStats = { total: 10, success: 8, error: 2, avgExecutionTimeMs: 50 };
      mockJobService.getJobStats.mockReturnValue(mockStats);

      const req = {};
      const res = createMockRes();

      await controller.getJobStats(req, res);

      expect(res.json).toHaveBeenCalledWith(mockStats);
    });

    it('returns 500 on error', async () => {
      mockJobService.getJobStats.mockImplementation(() => { throw new Error('stats error'); });

      const req = {};
      const res = createMockRes();

      await controller.getJobStats(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getCacheAnalysis', () => {
    it('returns enriched cache entries', async () => {
      mockCacheService.getCacheEntries.mockResolvedValue([
        { key: 'key-1', size: 1000, lastModified: new Date() },
      ]);

      mockJobService.databaseService.getDb.mockReturnValue({
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([
            { cache_key: 'key-1', count: 5, last_used: '2024-01-01 00:00:00' },
          ]),
        }),
      });

      const req = {
        app: { get: vi.fn().mockReturnValue(1073741824) },
      };
      const res = createMockRes();

      await controller.getCacheAnalysis(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.entries).toHaveLength(1);
      expect(response.entries[0].key).toBe('key-1');
      expect(response.entries[0].jobCount).toBe(5);
      expect(response.totalSize).toBe(1000);
      expect(response.sizeLimit).toBe(1073741824);
    });

    it('sets jobCount to 0 for cache entries without matching jobs', async () => {
      mockCacheService.getCacheEntries.mockResolvedValue([
        { key: 'orphan-key', size: 500 },
      ]);

      const req = {
        app: { get: vi.fn().mockReturnValue(1024) },
      };
      const res = createMockRes();

      await controller.getCacheAnalysis(req, res);

      const response = res.json.mock.calls[0][0];
      expect(response.entries[0].jobCount).toBe(0);
      expect(response.entries[0].lastUsed).toBeNull();
    });

    it('returns 500 on error', async () => {
      mockCacheService.getCacheEntries.mockRejectedValue(new Error('cache error'));

      const req = { app: { get: vi.fn() } };
      const res = createMockRes();

      await controller.getCacheAnalysis(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('submitJob', () => {
    it('returns 400 when code is missing', async () => {
      const req = { body: { cacheKey: 'key' }, ip: '127.0.0.1', headers: {} };
      const res = createMockRes();

      await controller.submitJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Code is required' });
    });

    it('returns 400 when cacheKey is missing', async () => {
      const req = { body: { code: 'code' }, ip: '127.0.0.1', headers: {} };
      const res = createMockRes();

      await controller.submitJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Cache key is required' });
    });

    it('creates a job and returns jobId', async () => {
      const req = {
        body: { code: 'module.exports = () => 1', cacheKey: 'k1' },
        ip: '127.0.0.1',
        headers: { 'user-agent': 'test' },
      };
      const res = createMockRes();

      await controller.submitJob(req, res);

      expect(mockJobService.createJob).toHaveBeenCalledWith(expect.objectContaining({
        code: 'module.exports = () => 1',
        cacheKey: 'k1',
        metadata: expect.objectContaining({ source: 'dashboard' }),
      }));
      expect(res.json).toHaveBeenCalledWith({ success: true, jobId: 'job-123-abc' });
    });

    it('returns 500 when createJob throws', async () => {
      mockJobService.createJob.mockImplementation(() => { throw new Error('create failed'); });

      const req = {
        body: { code: 'code', cacheKey: 'k' },
        ip: '127.0.0.1',
        headers: {},
      };
      const res = createMockRes();

      await controller.submitJob(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('_executeJobAsync', () => {
    it('completes job with success on successful execution', async () => {
      mockExecutionController.executeCodeInternal.mockResolvedValue({
        success: true,
        data: [1, 2],
        console: ['log'],
        debug: {
          execution: { totalResponseTimeMs: '42.00', dependencyInstallTimeMs: '10.00' },
          cache: { usedCache: true },
        },
      });

      await controller._executeJobAsync('job-1', {
        code: 'code',
        items: [],
        cacheKey: 'k',
        options: {},
      });

      expect(mockJobService.updateJobStatus).toHaveBeenCalledWith('job-1', 'running');
      expect(mockJobService.completeJob).toHaveBeenCalledWith('job-1', expect.objectContaining({
        status: 'success',
        resultData: [1, 2],
      }));
    });

    it('completes job with error on failed execution result', async () => {
      mockExecutionController.executeCodeInternal.mockResolvedValue({
        success: false,
        error: 'runtime error',
        stack: 'Error: runtime error',
        console: [],
      });

      await controller._executeJobAsync('job-2', {
        code: 'code',
        items: [],
        cacheKey: 'k',
        options: {},
      });

      expect(mockJobService.completeJob).toHaveBeenCalledWith('job-2', expect.objectContaining({
        status: 'error',
        errorMessage: 'runtime error',
      }));
    });

    it('completes job with error when execution throws', async () => {
      mockExecutionController.executeCodeInternal.mockRejectedValue(
        new Error('unexpected crash')
      );

      await controller._executeJobAsync('job-3', {
        code: 'code',
        items: [],
        cacheKey: 'k',
        options: {},
      });

      expect(mockJobService.completeJob).toHaveBeenCalledWith('job-3', expect.objectContaining({
        status: 'error',
        errorMessage: 'unexpected crash',
      }));
    });
  });

  describe('pollJob', () => {
    it('returns job data', async () => {
      const mockJob = { job_id: 'j1', status: 'running' };
      mockJobService.getJob.mockReturnValue(mockJob);

      const req = { params: { jobId: 'j1' } };
      const res = createMockRes();

      await controller.pollJob(req, res);

      expect(res.json).toHaveBeenCalledWith(mockJob);
    });

    it('returns 404 when job not found', async () => {
      mockJobService.getJob.mockReturnValue(null);

      const req = { params: { jobId: 'missing' } };
      const res = createMockRes();

      await controller.pollJob(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 500 on error', async () => {
      mockJobService.getJob.mockImplementation(() => { throw new Error('poll error'); });

      const req = { params: { jobId: 'j1' } };
      const res = createMockRes();

      await controller.pollJob(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deleteJob', () => {
    it('returns success when job is deleted', async () => {
      mockJobService.deleteJob.mockReturnValue(true);

      const req = { params: { jobId: 'j1' } };
      const res = createMockRes();

      await controller.deleteJob(req, res);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('returns 404 when job not found', async () => {
      mockJobService.deleteJob.mockReturnValue(false);

      const req = { params: { jobId: 'nonexistent' } };
      const res = createMockRes();

      await controller.deleteJob(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('returns 500 on error', async () => {
      mockJobService.deleteJob.mockImplementation(() => { throw new Error('delete error'); });

      const req = { params: { jobId: 'j1' } };
      const res = createMockRes();

      await controller.deleteJob(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
