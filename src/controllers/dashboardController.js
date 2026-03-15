const { generateToken } = require('../middleware/dashboardAuth');
const { execSync } = require('child_process');
const path = require('path');

class DashboardController {
  constructor(jobService, cacheService, executionController) {
    this.jobService = jobService;
    this.cacheService = cacheService;
    this.executionController = executionController;

    // Cache system info at startup
    const pkg = require(path.join(__dirname, '../../package.json'));
    this._systemInfo = {
      version: pkg.version,
      nodeVersion: process.version,
      pnpmVersion: this._getPnpmVersion(),
    };
  }

  _getPnpmVersion() {
    try {
      return execSync('pnpm --version', { encoding: 'utf8' }).trim();
    } catch {
      return null;
    }
  }

  async login(req, res) {
    const { secretKey } = req.body;
    const serverSecret = req.app.get('secretKey');

    if (!serverSecret) {
      // No auth configured, just set a dummy cookie
      res.cookie('codeharbor_session', 'no-auth', { httpOnly: true, sameSite: 'strict', path: '/' });
      return res.json({ success: true });
    }

    if (secretKey !== serverSecret) {
      return res.status(403).json({ success: false, error: 'Invalid secret key' });
    }

    const token = generateToken(serverSecret);
    res.cookie('codeharbor_session', token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });
    return res.json({ success: true });
  }

  async logout(req, res) {
    res.clearCookie('codeharbor_session', { path: '/' });
    return res.json({ success: true });
  }

  async getJobs(req, res) {
    try {
      const { status, cacheKey, search, sortBy, sortOrder, page, limit } = req.query;
      const result = this.jobService.getJobs({
        status, cacheKey, search, sortBy, sortOrder,
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 20,
      });
      return res.json(result);
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getJob(req, res) {
    try {
      const job = this.jobService.getJob(req.params.jobId);
      if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
      return res.json(job);
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getJobStats(req, res) {
    try {
      const stats = this.jobService.getJobStats();
      return res.json(stats);
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getCacheAnalysis(req, res) {
    try {
      const entries = await this.cacheService.getCacheEntries();
      const cacheSizeLimit = req.app.get('cacheSizeLimit');
      const totalSize = entries.reduce((sum, e) => sum + e.size, 0);

      // Get job counts per cache key
      const db = this.jobService.databaseService.getDb();
      const jobCounts = db.prepare(
        'SELECT cache_key, COUNT(*) as count, MAX(created_at) as last_used FROM jobs WHERE cache_key IS NOT NULL GROUP BY cache_key'
      ).all();
      const jobCountMap = {};
      for (const row of jobCounts) {
        jobCountMap[row.cache_key] = { count: row.count, lastUsed: row.last_used };
      }

      const fs = require('fs');
      const enrichedEntries = entries.map(e => {
        let dependencies = null;
        try {
          const pinnedPath = path.join(e.path, 'pinned-versions.json');
          if (fs.existsSync(pinnedPath)) {
            dependencies = JSON.parse(fs.readFileSync(pinnedPath, 'utf8'));
          }
        } catch {}
        return {
          ...e,
          dependencies,
          jobCount: jobCountMap[e.key]?.count || 0,
          lastUsed: jobCountMap[e.key]?.lastUsed || null,
        };
      });

      return res.json({ entries: enrichedEntries, totalSize, sizeLimit: cacheSizeLimit });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async submitJob(req, res) {
    try {
      const { code, items, cacheKey, options } = req.body;
      if (!code) return res.status(400).json({ success: false, error: 'Code is required' });
      if (!cacheKey) return res.status(400).json({ success: false, error: 'Cache key is required' });

      const jobId = this.jobService.createJob({
        code, items, cacheKey, options,
        metadata: { ip: req.ip, userAgent: req.headers['user-agent'], source: 'dashboard' }
      });

      // Execute async - don't await
      this._executeJobAsync(jobId, { code, items: items || [], cacheKey, options: options || {} });

      return res.json({ success: true, jobId });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async _executeJobAsync(jobId, { code, items, cacheKey, options }) {
    try {
      this.jobService.updateJobStatus(jobId, 'running');

      // Build a fake req/res to reuse executeCode logic
      const result = await this.executionController.executeCodeInternal({
        code, items, cacheKey, options
      });

      if (result.success) {
        this.jobService.completeJob(jobId, {
          status: 'success',
          resultData: result.data,
          consoleOutput: result.console,
          executionTimeMs: result.debug?.execution?.totalResponseTimeMs ? parseFloat(result.debug.execution.totalResponseTimeMs) : null,
          depInstallTimeMs: result.debug?.execution?.dependencyInstallTimeMs ? parseFloat(result.debug.execution.dependencyInstallTimeMs) : null,
          usedCache: result.debug?.cache?.usedCache || false,
          dependencies: result.debug?.execution?.installedDependencies || null,
        });
      } else {
        this.jobService.completeJob(jobId, {
          status: 'error',
          consoleOutput: result.console,
          errorMessage: result.error,
          errorStack: result.stack,
          executionTimeMs: result.debug?.execution?.totalResponseTimeMs ? parseFloat(result.debug.execution.totalResponseTimeMs) : null,
          depInstallTimeMs: result.debug?.execution?.dependencyInstallTimeMs ? parseFloat(result.debug.execution.dependencyInstallTimeMs) : null,
          usedCache: result.debug?.cache?.usedCache || false,
        });
      }
    } catch (error) {
      this.jobService.completeJob(jobId, {
        status: 'error',
        errorMessage: error.error || error.message || 'Unknown error',
        errorStack: error.stack || null,
        consoleOutput: error.console || [],
        executionTimeMs: null,
        depInstallTimeMs: null,
        usedCache: false,
        dependencies: null,
      });
    }
  }

  async pollJob(req, res) {
    try {
      const job = this.jobService.getJob(req.params.jobId);
      if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
      return res.json(job);
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async deleteJob(req, res) {
    try {
      const deleted = this.jobService.deleteJob(req.params.jobId);
      if (!deleted) return res.status(404).json({ success: false, error: 'Job not found' });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  async getInfo(req, res) {
    return res.json(this._systemInfo);
  }
}

module.exports = DashboardController;
