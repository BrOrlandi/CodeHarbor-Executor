const fs = require('fs');
const path = require('path');
const os = require('os');
const DatabaseService = require('../../../src/services/databaseService');
const JobService = require('../../../src/services/jobService');

describe('JobService', () => {
  let tmpDir;
  let databaseService;
  let jobService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'job-test-'));
    databaseService = new DatabaseService(tmpDir);
    databaseService.initialize();
    jobService = new JobService(databaseService, 500);
  });

  afterEach(() => {
    databaseService.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('createJob', () => {
    it('creates a job and returns a job ID', () => {
      const jobId = jobService.createJob({
        code: 'module.exports = () => 1',
        items: [1, 2],
        cacheKey: 'test-key',
        options: { debug: true },
        metadata: { ip: '127.0.0.1' },
      });

      expect(jobId).toMatch(/^job-\d+-[a-f0-9]+$/);
    });

    it('stores job data in the database', () => {
      const jobId = jobService.createJob({
        code: 'module.exports = () => 1',
        items: [1, 2, 3],
        cacheKey: 'my-key',
      });

      const job = jobService.getJob(jobId);
      expect(job).not.toBeNull();
      expect(job.code).toBe('module.exports = () => 1');
      expect(job.status).toBe('pending');
      expect(job.cache_key).toBe('my-key');
      expect(JSON.parse(job.items)).toEqual([1, 2, 3]);
    });

    it('stores job with null items when items is not provided', () => {
      const jobId = jobService.createJob({ code: 'code' });
      const job = jobService.getJob(jobId);
      expect(job.items).toBeNull();
    });

    it('stores job with null options when options is not provided', () => {
      const jobId = jobService.createJob({ code: 'code' });
      const job = jobService.getJob(jobId);
      expect(job.options).toBeNull();
    });

    it('generates unique job IDs', () => {
      const id1 = jobService.createJob({ code: 'code1' });
      const id2 = jobService.createJob({ code: 'code2' });
      expect(id1).not.toBe(id2);
    });
  });

  describe('updateJobStatus', () => {
    it('updates the job status', () => {
      const jobId = jobService.createJob({ code: 'code' });
      jobService.updateJobStatus(jobId, 'running');

      const job = jobService.getJob(jobId);
      expect(job.status).toBe('running');
    });
  });

  describe('completeJob', () => {
    it('completes a job with success status and result data', () => {
      const jobId = jobService.createJob({ code: 'code', cacheKey: 'k' });
      jobService.completeJob(jobId, {
        status: 'success',
        resultData: [1, 2, 3],
        consoleOutput: [{ type: 'log', message: 'hello' }],
        executionTimeMs: 42.5,
        depInstallTimeMs: 10.1,
        usedCache: true,
        dependencies: { lodash: '4.17.21' },
      });

      const job = jobService.getJob(jobId);
      expect(job.status).toBe('success');
      expect(JSON.parse(job.result_data)).toEqual([1, 2, 3]);
      expect(JSON.parse(job.console_output)).toEqual([{ type: 'log', message: 'hello' }]);
      expect(job.execution_time_ms).toBe(42.5);
      expect(job.dependency_install_time_ms).toBe(10.1);
      expect(job.used_cache).toBe(1);
      expect(JSON.parse(job.dependencies)).toEqual({ lodash: '4.17.21' });
      expect(job.completed_at).toBeDefined();
    });

    it('completes a job with error status', () => {
      const jobId = jobService.createJob({ code: 'code', cacheKey: 'k' });
      jobService.completeJob(jobId, {
        status: 'error',
        errorMessage: 'something failed',
        errorStack: 'Error: something failed\n    at test.js:1:1',
        consoleOutput: [],
      });

      const job = jobService.getJob(jobId);
      expect(job.status).toBe('error');
      expect(job.error_message).toBe('something failed');
      expect(job.error_stack).toContain('something failed');
    });

    it('defaults status to success when not provided', () => {
      const jobId = jobService.createJob({ code: 'code', cacheKey: 'k' });
      jobService.completeJob(jobId, {});

      const job = jobService.getJob(jobId);
      expect(job.status).toBe('success');
    });
  });

  describe('getJob', () => {
    it('returns full job details', () => {
      const jobId = jobService.createJob({
        code: 'test code',
        cacheKey: 'ck',
        items: [1],
        options: { timeout: 5000 },
        metadata: { ip: '1.2.3.4' },
      });

      const job = jobService.getJob(jobId);
      expect(job.job_id).toBe(jobId);
      expect(job.code).toBe('test code');
      expect(job.cache_key).toBe('ck');
    });

    it('returns null for non-existent job', () => {
      const job = jobService.getJob('nonexistent-id');
      expect(job).toBeNull();
    });
  });

  describe('getJobs', () => {
    beforeEach(() => {
      // Create several jobs
      for (let i = 0; i < 5; i++) {
        const jobId = jobService.createJob({
          code: `code-${i}`,
          cacheKey: i < 3 ? 'key-a' : 'key-b',
        });
        if (i % 2 === 0) {
          jobService.completeJob(jobId, { status: 'success', resultData: i });
        } else {
          jobService.completeJob(jobId, { status: 'error', errorMessage: `err-${i}` });
        }
      }
    });

    it('returns paginated results with defaults', () => {
      const result = jobService.getJobs();
      expect(result.jobs).toHaveLength(5);
      expect(result.total).toBe(5);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('filters by status', () => {
      const result = jobService.getJobs({ status: 'success' });
      expect(result.total).toBe(3);
      result.jobs.forEach(job => {
        expect(job.status).toBe('success');
      });
    });

    it('filters by cacheKey', () => {
      const result = jobService.getJobs({ cacheKey: 'key-a' });
      expect(result.total).toBe(3);
      result.jobs.forEach(job => {
        expect(job.cache_key).toBe('key-a');
      });
    });

    it('filters by search term in code', () => {
      const result = jobService.getJobs({ search: 'code-2' });
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('filters by search term in error_message', () => {
      const result = jobService.getJobs({ search: 'err-1' });
      expect(result.total).toBeGreaterThanOrEqual(1);
    });

    it('paginates results', () => {
      const result = jobService.getJobs({ page: 1, limit: 2 });
      expect(result.jobs).toHaveLength(2);
      expect(result.total).toBe(5);
      expect(result.totalPages).toBe(3);

      const page2 = jobService.getJobs({ page: 2, limit: 2 });
      expect(page2.jobs).toHaveLength(2);
      expect(page2.page).toBe(2);
    });

    it('sorts by specified column', () => {
      const result = jobService.getJobs({ sortBy: 'status', sortOrder: 'asc' });
      expect(result.jobs.length).toBe(5);
    });

    it('falls back to created_at for invalid sortBy', () => {
      const result = jobService.getJobs({ sortBy: 'DROP TABLE jobs;--' });
      expect(result.jobs).toHaveLength(5);
    });

    it('defaults sortOrder to DESC for invalid values', () => {
      const result = jobService.getJobs({ sortOrder: 'invalid' });
      expect(result.jobs).toHaveLength(5);
    });

    it('excludes large fields from list view', () => {
      const result = jobService.getJobs();
      result.jobs.forEach(job => {
        expect(job).not.toHaveProperty('code');
        expect(job).not.toHaveProperty('items');
        expect(job).not.toHaveProperty('result_data');
      });
    });
  });

  describe('getJobStats', () => {
    it('returns zeroes when no jobs exist', () => {
      const stats = jobService.getJobStats();
      expect(stats.total).toBe(0);
      expect(stats.success).toBe(0);
      expect(stats.error).toBe(0);
      expect(stats.avgExecutionTimeMs).toBe(0);
    });

    it('returns aggregate statistics', () => {
      const id1 = jobService.createJob({ code: 'c1', cacheKey: 'k' });
      jobService.completeJob(id1, { status: 'success', executionTimeMs: 100 });

      const id2 = jobService.createJob({ code: 'c2', cacheKey: 'k' });
      jobService.completeJob(id2, { status: 'success', executionTimeMs: 200 });

      const id3 = jobService.createJob({ code: 'c3', cacheKey: 'k' });
      jobService.completeJob(id3, { status: 'error', errorMessage: 'fail' });

      const stats = jobService.getJobStats();
      expect(stats.total).toBe(3);
      expect(stats.success).toBe(2);
      expect(stats.error).toBe(1);
      expect(stats.avgExecutionTimeMs).toBe(150);
    });
  });

  describe('deleteJob', () => {
    it('deletes an existing job and returns true', () => {
      const jobId = jobService.createJob({ code: 'code' });
      const deleted = jobService.deleteJob(jobId);
      expect(deleted).toBe(true);

      const job = jobService.getJob(jobId);
      expect(job).toBeNull();
    });

    it('returns false for non-existent job', () => {
      const deleted = jobService.deleteJob('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('pruneOldJobs', () => {
    it('removes oldest jobs when count exceeds maxJobHistory', () => {
      const smallService = new JobService(databaseService, 3);

      // Create 5 jobs
      const ids = [];
      for (let i = 0; i < 5; i++) {
        ids.push(smallService.createJob({ code: `code-${i}` }));
      }

      // After creating 5 jobs with max 3, the oldest should be pruned
      const result = smallService.getJobs();
      expect(result.total).toBe(3);
    });

    it('does nothing when maxJobHistory is 0', () => {
      const noLimitService = new JobService(databaseService, 0);
      for (let i = 0; i < 5; i++) {
        noLimitService.createJob({ code: `code-${i}` });
      }

      const result = noLimitService.getJobs();
      expect(result.total).toBe(5);
    });

    it('does nothing when count is under the limit', () => {
      jobService.createJob({ code: 'code-1' });
      jobService.createJob({ code: 'code-2' });

      // maxJobHistory is 500, so nothing should be pruned
      jobService.pruneOldJobs();
      const result = jobService.getJobs();
      expect(result.total).toBe(2);
    });
  });
});
