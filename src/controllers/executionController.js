const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');
const crypto = require('crypto');
const fs = require('fs/promises');

class ExecutionController {
  constructor(dependencyService, executionService, cacheService, cacheDir) {
    this.dependencyService = dependencyService;
    this.executionService = executionService;
    this.cacheService = cacheService;
    this.cacheDir = cacheDir;
  }

  /**
   * Format bytes into human readable format
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

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
   * Handle code execution requests
   */
  async executeCode(req, res) {
    const { code, items = [], cacheKey, options = {} } = req.body;

    // Track start time to measure total response time
    const apiStartTime = performance.now();

    // Initialize debug info if debugging is enabled
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

    // Extract options
    const executionTimeout = options.timeout || undefined; // Will use default from service
    const forceUpdate = options.forceUpdate || false;

    // Log execution request
    console.log(
      `Execution request: cacheKey=${cacheKey}, forceUpdate=${forceUpdate}, debug=${!!options.debug}`
    );

    // Extract dependencies from the code
    const dependencies = this.dependencyService.extractDependencies(code);
    console.log('Extracted dependencies:', dependencies);

    // Create execution directory
    let executionDir;
    try {
      executionDir = await this.executionService.createExecutionDir();

      // Setup cache path
      const cachePath = path.join(path.resolve(this.cacheDir), cacheKey);

      if (debugInfo) {
        // Get total cache size before installation
        const cacheEntries = await this.cacheService.getCacheEntries();
        debugInfo.cache.totalCacheSize = cacheEntries.reduce(
          (sum, entry) => sum + entry.size,
          0
        );
      }

      // Install dependencies
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

        // Check if cache was used
        const cacheInfo = await this.cacheService.getCacheEntryInfo(cacheKey);
        debugInfo.cache.usedCache = cacheInfo.exists && !forceUpdate;

        // Get current cache size
        if (cacheInfo.exists) {
          debugInfo.cache.currentCacheSize = cacheInfo.size;
          debugInfo.cache.currentCacheSizeFormatted = this.formatBytes(
            cacheInfo.size
          );
        }

        // Get total cache size after installation
        const updatedCacheEntries = await this.cacheService.getCacheEntries();
        const totalSize = updatedCacheEntries.reduce(
          (sum, entry) => sum + entry.size,
          0
        );
        debugInfo.cache.totalCacheSize = totalSize;
        debugInfo.cache.totalCacheSizeFormatted = this.formatBytes(totalSize);

        // Store actual installed dependencies for debug info
        debugInfo.execution.installedDependencies = installResult.dependencies;
      }

      // Print items
      // console.log('Items:', items);

      // Execute the code
      const result = await this.executionService.executeCode(
        code,
        items,
        executionDir,
        executionTimeout,
        options.debug
      );

      // Calculate total response time
      if (debugInfo) {
        const apiEndTime = performance.now();
        debugInfo.execution.totalResponseTimeMs = (
          apiEndTime - apiStartTime
        ).toFixed(2);

        // Merge debug info from execution with our collected info
        if (result.debug) {
          result.debug = {
            ...result.debug,
            ...debugInfo,
          };
        } else {
          result.debug = debugInfo;
        }
      }

      // Clean up the execution directory
      await this.executionService.cleanupExecutionDir(executionDir);

      return res.json(result);
    } catch (error) {
      console.error('Error: ' + error.stack);

      // Clean up the execution directory if it was created
      if (executionDir) {
        await this.executionService.cleanupExecutionDir(executionDir);
      }

      // Calculate total response time for error case
      if (debugInfo) {
        const apiEndTime = performance.now();
        debugInfo.execution.totalResponseTimeMs = (
          apiEndTime - apiStartTime
        ).toFixed(2);

        // Add debug info to error response if requested
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

      return res.status(200).json({
        success: false,
        error: error.error || 'Internal server error',
        stack: filteredStack,
        ...(options.debug && !error.debug ? { debug: debugInfo } : {}),
      });
    }
  }

  /**
   * Health check endpoint handler
   */
  async healthCheck(req, res) {
    return res.json({
      status: 'ok',
      version: '1.0.0',
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
