const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');
const crypto = require('crypto');
const fs = require('fs/promises');

class ExecutionController {
  constructor(dependencyService, executionService, cacheService, cacheDir, jobService) {
    this.dependencyService = dependencyService;
    this.executionService = executionService;
    this.cacheService = cacheService;
    this.cacheDir = cacheDir;
    this.jobService = jobService || null;
  }

  /**
   * Format bytes into human readable format
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes <= 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Filter error stack to remove sensitive server information
   * @param {Error} error - The error object with stack trace
   * @returns {string} - Filtered stack trace
   */
  filterErrorStack(error) {
    if (!error.stack) return 'Error: No stack trace available';

    return error.stack
      .split('\n')
      .map((line, index) => {
        // Keep the error message (first line) intact
        if (index === 0) {
          return line;
        }

        // Filter and clean stack trace lines
        if (line.includes('execution.js') || line.includes('/node_modules/')) {
          // Remove server paths before execution.js
          if (line.includes('execution.js')) {
            const execMatch = line.match(/(.+)\/execution\.js/);
            if (execMatch) {
              return line.replace(execMatch[1] + '/', '');
            }
          }

          // Remove server paths before node_modules
          if (line.includes('/node_modules/')) {
            const nodeModulesMatch = line.match(/(.+)(\/node_modules\/)/);
            if (nodeModulesMatch) {
              return line.replace(nodeModulesMatch[1], '');
            }
          }
        }

        // For lines that don't match our criteria, only include if they seem to be code
        if (
          line.includes('wrapper.js') ||
          line.toLowerCase().includes('eval')
        ) {
          return '    at [code]';
        }

        return null;
      })
      .filter(Boolean)
      .join('\n');
  }

  /**
   * Core execution logic extracted for reuse by dashboard submitJob
   * Returns the result object without writing to response
   */
  async executeCodeInternal({ code, items = [], cacheKey, options = {} }) {
    const apiStartTime = performance.now();

    let debugInfo = options.debug
      ? {
          server: {
            nodeVersion: process.version,
          },
          cache: {
            usedCache: false,
            cacheKey: cacheKey,
            currentCacheSize: 0,
            currentCacheSizeFormatted: '0 Bytes',
            totalCacheSize: 0,
            totalCacheSizeFormatted: '0 Bytes',
          },
          execution: {
            startTime: new Date().toISOString(),
            totalResponseTimeMs: 0,
          },
        }
      : null;

    const executionTimeout = options.timeout || undefined;
    const forceUpdate = options.forceUpdate || false;

    console.log(
      `Execution request: cacheKey=${cacheKey}, forceUpdate=${forceUpdate}, debug=${!!options.debug}`
    );

    const dependencies = this.dependencyService.extractDependencies(code);
    console.log('Extracted dependencies:', dependencies);

    let executionDir;
    try {
      executionDir = await this.executionService.createExecutionDir();
      const cachePath = path.join(path.resolve(this.cacheDir), cacheKey);

      if (debugInfo) {
        const cacheEntries = await this.cacheService.getCacheEntries();
        debugInfo.cache.totalCacheSize = cacheEntries.reduce(
          (sum, entry) => sum + entry.size,
          0
        );
      }

      const installStartTime = performance.now();
      const installResult = await this.dependencyService.installDependencies(
        dependencies,
        executionDir,
        cacheKey,
        cachePath,
        forceUpdate
      );

      if (debugInfo) {
        const installEndTime = performance.now();
        debugInfo.execution.dependencyInstallTimeMs = (
          installEndTime - installStartTime
        ).toFixed(2);

        const cacheInfo = await this.cacheService.getCacheEntryInfo(cacheKey);
        debugInfo.cache.usedCache = cacheInfo.exists && !forceUpdate;

        if (cacheInfo.exists) {
          debugInfo.cache.currentCacheSize = cacheInfo.size;
          debugInfo.cache.currentCacheSizeFormatted = this.formatBytes(
            cacheInfo.size
          );
        }

        const updatedCacheEntries = await this.cacheService.getCacheEntries();
        const totalSize = updatedCacheEntries.reduce(
          (sum, entry) => sum + entry.size,
          0
        );
        debugInfo.cache.totalCacheSize = totalSize;
        debugInfo.cache.totalCacheSizeFormatted = this.formatBytes(totalSize);

        debugInfo.execution.installedDependencies = installResult.dependencies;
      }

      const result = await this.executionService.executeCode(
        code,
        items,
        executionDir,
        executionTimeout,
        options.debug
      );

      if (debugInfo) {
        const apiEndTime = performance.now();
        debugInfo.execution.totalResponseTimeMs = (
          apiEndTime - apiStartTime
        ).toFixed(2);

        if (result.debug) {
          result.debug = {
            ...result.debug,
            ...debugInfo,
          };
        } else {
          result.debug = debugInfo;
        }
      }

      await this.executionService.cleanupExecutionDir(executionDir);

      return result;
    } catch (error) {
      console.error('Error: ' + error.stack);

      if (executionDir) {
        await this.executionService.cleanupExecutionDir(executionDir);
      }

      if (debugInfo) {
        const apiEndTime = performance.now();
        debugInfo.execution.totalResponseTimeMs = (
          apiEndTime - apiStartTime
        ).toFixed(2);

        if (error.debug) {
          error.debug = {
            ...error.debug,
            ...debugInfo,
          };
        } else if (options.debug) {
          error.debug = debugInfo;
        }
      }

      const filteredStack = this.filterErrorStack(error);

      if (!error.error && error.console && error.console.length > 0) {
        error.error = error.console[0].message;
      }

      return {
        success: false,
        error: error.error || 'Internal server error',
        stack: filteredStack,
        console: error.console || [],
        ...(options.debug && !error.debug ? { debug: debugInfo } : {}),
        ...(error.debug ? { debug: error.debug } : {}),
      };
    }
  }

  /**
   * Handle code execution requests
   */
  async executeCode(req, res) {
    const { code, items = [], cacheKey, options = {} } = req.body;

    if (!code) {
      return res
        .status(400)
        .json({ success: false, error: 'Code is required' });
    }

    if (!cacheKey) {
      return res.status(400).json({
        success: false,
        error:
          'Cache key is required (should be a hash of workflow ID and node name)',
      });
    }

    // Create job record if jobService is available
    let jobId = null;
    if (this.jobService) {
      try {
        const metadata = {
          ip: req.ip,
          userAgent: req.get('user-agent'),
        };
        jobId = this.jobService.createJob({
          code,
          items,
          cacheKey,
          options,
          metadata,
        });
        this.jobService.updateJobStatus(jobId, 'running');
      } catch (err) {
        console.error('Failed to create job record:', err);
      }
    }

    let result;
    try {
      result = await this.executeCodeInternal({ code, items, cacheKey, options });
    } catch (err) {
      console.error('Unexpected execution error:', err);
      if (this.jobService && jobId) {
        try { this.jobService.completeJob(jobId, { status: 'error', errorMessage: err.message || 'Internal error' }); } catch {}
      }
      return res.status(500).json({ success: false, error: 'Internal server error', ...(jobId ? { jobId } : {}) });
    }

    // Complete job record if jobService is available
    if (this.jobService && jobId) {
      try {
        if (result.success) {
          this.jobService.completeJob(jobId, {
            status: 'success',
            resultData: result.data,
            consoleOutput: result.console,
            executionTimeMs: result.debug?.execution?.totalResponseTimeMs
              ? parseFloat(result.debug.execution.totalResponseTimeMs)
              : null,
            depInstallTimeMs: result.debug?.execution?.dependencyInstallTimeMs
              ? parseFloat(result.debug.execution.dependencyInstallTimeMs)
              : null,
            usedCache: result.debug?.cache?.usedCache || false,
            dependencies: result.debug?.execution?.installedDependencies || null,
          });
        } else {
          this.jobService.completeJob(jobId, {
            status: 'error',
            consoleOutput: result.console,
            errorMessage: result.error,
            errorStack: result.stack,
            executionTimeMs: result.debug?.execution?.totalResponseTimeMs
              ? parseFloat(result.debug.execution.totalResponseTimeMs)
              : null,
            depInstallTimeMs: result.debug?.execution?.dependencyInstallTimeMs
              ? parseFloat(result.debug.execution.dependencyInstallTimeMs)
              : null,
            usedCache: result.debug?.cache?.usedCache || false,
          });
        }
      } catch (err) {
        console.error('Failed to complete job record:', err);
      }
    }

    // Add jobId to response if available
    if (jobId) {
      result.jobId = jobId;
    }

    if (result.success) {
      return res.json(result);
    } else {
      return res.status(200).json(result);
    }
  }

  /**
   * Health check endpoint handler
   */
  async healthCheck(req, res) {
    return res.json({
      status: 'ok',
      version: '2.1.0',
      auth: req.app.get('secretKey') ? 'enabled' : 'disabled',
      defaultTimeout: `${req.app.get('defaultTimeout')}ms`,
    });
  }

  /**
   * Verify authentication credentials
   */
  async verifyAuth(req, res) {
    // This endpoint will only be accessible if authentication passes
    // So if we get here, the auth is valid
    return res.json({
      success: true,
      message: 'Authentication successful',
      authenticated: true,
    });
  }
}

module.exports = ExecutionController;
