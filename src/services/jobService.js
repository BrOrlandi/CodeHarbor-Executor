const crypto = require('crypto');

class JobService {
  constructor(databaseService, maxJobHistory = 500) {
    this.databaseService = databaseService;
    this.maxJobHistory = maxJobHistory;
  }

  /**
   * Generate a unique job ID
   */
  _generateJobId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    return `job-${timestamp}-${random}`;
  }

  /**
   * Create a new job record
   */
  createJob({ code, items, cacheKey, options, metadata }) {
    const db = this.databaseService.getDb();
    const jobId = this._generateJobId();

    const stmt = db.prepare(`
      INSERT INTO jobs (job_id, status, code, items, cache_key, options, request_metadata)
      VALUES (@job_id, 'pending', @code, @items, @cache_key, @options, @request_metadata)
    `);

    stmt.run({
      job_id: jobId,
      code: code || '',
      items: items != null ? JSON.stringify(items) : null,
      cache_key: cacheKey || null,
      options: options ? JSON.stringify(options) : null,
      request_metadata: metadata ? JSON.stringify(metadata) : null,
    });

    // Prune old jobs after creating a new one
    this.pruneOldJobs();

    return jobId;
  }

  /**
   * Update job status
   */
  updateJobStatus(jobId, status) {
    const db = this.databaseService.getDb();
    const stmt = db.prepare('UPDATE jobs SET status = ? WHERE job_id = ?');
    stmt.run(status, jobId);
  }

  /**
   * Complete a job with results
   */
  completeJob(jobId, {
    status,
    resultData,
    consoleOutput,
    errorMessage,
    errorStack,
    executionTimeMs,
    depInstallTimeMs,
    usedCache,
    dependencies,
  }) {
    const db = this.databaseService.getDb();
    const stmt = db.prepare(`
      UPDATE jobs SET
        status = @status,
        result_data = @result_data,
        console_output = @console_output,
        error_message = @error_message,
        error_stack = @error_stack,
        execution_time_ms = @execution_time_ms,
        dependency_install_time_ms = @dep_install_time_ms,
        used_cache = @used_cache,
        dependencies = @dependencies,
        completed_at = datetime('now')
      WHERE job_id = @job_id
    `);

    stmt.run({
      job_id: jobId,
      status: status || 'success',
      result_data: resultData != null ? JSON.stringify(resultData) : null,
      console_output: consoleOutput != null ? JSON.stringify(consoleOutput) : null,
      error_message: errorMessage || null,
      error_stack: errorStack || null,
      execution_time_ms: executionTimeMs != null ? executionTimeMs : null,
      dep_install_time_ms: depInstallTimeMs != null ? depInstallTimeMs : null,
      used_cache: usedCache ? 1 : 0,
      dependencies: dependencies ? JSON.stringify(dependencies) : null,
    });
  }

  /**
   * Prune oldest jobs when count exceeds MAX_JOB_HISTORY
   */
  pruneOldJobs() {
    if (this.maxJobHistory <= 0) return;

    const db = this.databaseService.getDb();
    const countResult = db.prepare('SELECT COUNT(*) as count FROM jobs').get();

    if (countResult.count > this.maxJobHistory) {
      const excess = countResult.count - this.maxJobHistory;
      db.prepare(`
        DELETE FROM jobs WHERE id IN (
          SELECT id FROM jobs ORDER BY created_at ASC LIMIT ?
        )
      `).run(excess);
    }
  }

  /**
   * Get paginated list of jobs with filters
   */
  getJobs({ status, cacheKey, search, sortBy = 'created_at', sortOrder = 'desc', page = 1, limit = 20 } = {}) {
    const db = this.databaseService.getDb();
    const conditions = [];
    const params = {};

    if (status) {
      conditions.push('status = @status');
      params.status = status;
    }

    if (cacheKey) {
      conditions.push('cache_key = @cacheKey');
      params.cacheKey = cacheKey;
    }

    if (search) {
      conditions.push('(code LIKE @search OR error_message LIKE @search OR job_id LIKE @search)');
      params.search = `%${search}%`;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Whitelist sortBy columns to prevent SQL injection
    const allowedSortColumns = ['created_at', 'completed_at', 'execution_time_ms', 'status', 'job_id'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeSortOrder = sortOrder === 'asc' ? 'ASC' : 'DESC';

    const offset = (page - 1) * limit;

    // Get total count
    const countRow = db
      .prepare(`SELECT COUNT(*) as total FROM jobs ${whereClause}`)
      .get(params);

    // Get paginated results (exclude large fields for list view)
    const jobs = db
      .prepare(
        `SELECT id, job_id, status, cache_key, execution_time_ms, dependency_install_time_ms,
                used_cache, error_message, created_at, completed_at
         FROM jobs ${whereClause}
         ORDER BY ${safeSortBy} ${safeSortOrder}
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit, offset });

    return {
      jobs,
      total: countRow.total,
      page,
      limit,
      totalPages: Math.ceil(countRow.total / limit),
    };
  }

  /**
   * Get full job detail by jobId
   */
  getJob(jobId) {
    const db = this.databaseService.getDb();
    const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId);
    return job || null;
  }

  /**
   * Get aggregate job statistics
   */
  getJobStats() {
    const db = this.databaseService.getDb();

    const stats = db
      .prepare(
        `SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
          AVG(CASE WHEN execution_time_ms IS NOT NULL THEN execution_time_ms END) as avg_execution_time_ms
        FROM jobs`
      )
      .get();

    return {
      total: stats.total || 0,
      success: stats.success || 0,
      error: stats.error || 0,
      avgExecutionTimeMs: stats.avg_execution_time_ms
        ? parseFloat(stats.avg_execution_time_ms.toFixed(2))
        : 0,
    };
  }

  /**
   * Delete a job by jobId
   */
  deleteJob(jobId) {
    const db = this.databaseService.getDb();
    const result = db
      .prepare('DELETE FROM jobs WHERE job_id = ?')
      .run(jobId);
    return result.changes > 0;
  }
}

module.exports = JobService;
