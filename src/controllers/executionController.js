const path = require('path');
const os = require('os');
const { performance } = require('perf_hooks');

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
            platform: process.platform,
            architecture: os.arch(),
            totalMemory: `${Math.round(os.totalmem() / (1024 * 1024))} MB`,
            freeMemory: `${Math.round(os.freemem() / (1024 * 1024))} MB`,
            cpus: os.cpus().length,
            uptime: `${Math.round(os.uptime() / 60)} minutes`,
          },
          cache: {
            usedCache: false,
            cacheKey: cacheKey,
            cachePath: '',
            currentCacheSize: 0,
            currentCacheSizeFormatted: '0 Bytes',
            totalCacheSize: 0,
            totalCacheSizeFormatted: '0 Bytes',
          },
          execution: {
            startTime: new Date().toISOString(),
            dependencies: {},
            executionTimeMs: 0,
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

    if (debugInfo) {
      debugInfo.execution.extractedDependencies = dependencies;
    }

    // Create execution directory
    let executionDir;
    try {
      executionDir = await this.executionService.createExecutionDir();

      // Setup cache path
      const cachePath = path.join(path.resolve(this.cacheDir), cacheKey);

      if (debugInfo) {
        debugInfo.cache.cachePath = cachePath;

        // Get total cache size before installation
        const cacheEntries = await this.cacheService.getCacheEntries();
        debugInfo.cache.totalCacheSize = cacheEntries.reduce(
          (sum, entry) => sum + entry.size,
          0
        );
      }

      // Install dependencies
      const installStartTime = performance.now();
      await this.dependencyService.installDependencies(
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
      }

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
      console.error('Error processing request:', error);

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

      return res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
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
}

module.exports = ExecutionController;
