const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');

class ExecutionService {
  constructor(executionDir, defaultTimeout, maxExecutionDirs) {
    this.executionDir = executionDir;
    this.defaultTimeout = defaultTimeout;
    // Use the passed maxExecutionDirs parameter, falling back to environment variable if not provided
    this.maxExecutionDirs =
      maxExecutionDirs ||
      parseInt(process.env.EXECUTIONS_DATA_PRUNE_MAX_COUNT, 10) ||
      100;
  }

  /**
   * Create a unique execution directory
   */
  async createExecutionDir() {
    const executionId = `exec-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    const executionDir = path.join(this.executionDir, executionId);
    await fs.mkdir(executionDir, { recursive: true });

    // After creating a new execution directory, prune old ones if needed
    await this.pruneOldExecutionDirs();

    return executionDir;
  }

  /**
   * Get all execution directories sorted by creation date (oldest first)
   */
  async getExecutionDirs() {
    try {
      // Ensure the execution directory exists
      await fs.mkdir(this.executionDir, { recursive: true });

      // Get all entries in the execution directory
      const entries = await fs.readdir(this.executionDir, {
        withFileTypes: true,
      });

      // Filter for directories and that start with "exec-"
      const executionDirs = entries
        .filter(
          (entry) => entry.isDirectory() && entry.name.startsWith('exec-')
        )
        .map((dir) => ({
          name: dir.name,
          path: path.join(this.executionDir, dir.name),
          // Extract timestamp from directory name (assuming format exec-{timestamp}-{random})
          timestamp: parseInt(dir.name.split('-')[1], 10) || 0,
        }));

      // Sort by timestamp (oldest first)
      return executionDirs.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      console.error('Error getting execution directories:', error);
      return [];
    }
  }

  /**
   * Prune old execution directories if they exceed the maximum count
   */
  async pruneOldExecutionDirs() {
    if (this.maxExecutionDirs <= 0) {
      // If maxExecutionDirs is 0 or negative, don't prune anything
      return;
    }

    try {
      // Get all execution directories sorted by timestamp (oldest first)
      const executionDirs = await this.getExecutionDirs();

      // If the number of dirs exceeds the maximum, delete the oldest ones
      if (executionDirs.length > this.maxExecutionDirs) {
        const dirsToDelete = executionDirs.slice(
          0,
          executionDirs.length - this.maxExecutionDirs
        );

        for (const dir of dirsToDelete) {
          try {
            await fs.rm(dir.path, { recursive: true, force: true });
            console.log(`Pruned old execution directory: ${dir.path}`);
          } catch (error) {
            console.error(
              `Failed to delete old execution directory ${dir.path}:`,
              error
            );
          }
        }
      }
    } catch (error) {
      console.error('Error pruning old execution directories:', error);
    }
  }

  /**
   * Execute code in a sandboxed environment
   */
  async executeCode(
    code,
    items,
    executionDir,
    timeout,
    collectDebugInfo = false
  ) {
    const executionFile = path.join(executionDir, 'execution.js');
    const dataFile = path.join(executionDir, 'data.json');
    const wrapperFile = path.join(executionDir, 'wrapper.js');
    const debugFile = path.join(executionDir, 'debug.json');

    // Start timing for execution
    const startTime = performance.now();

    try {
      // Write the user code to a file
      await fs.writeFile(executionFile, code);

      // Write the input data to a file
      await fs.writeFile(dataFile, JSON.stringify(items));

      // Create a wrapper script that will import the user code and execute it
      const wrapperCode = `
        const userModule = require('./execution.js');
        const fs = require('fs');
        const path = require('path');

        // Initialize console capture array
        const consoleCapture = [];

        // Save original console methods
        const originalConsole = {
          log: console.log,
          info: console.info,
          warn: console.warn,
          error: console.error,
          debug: console.debug
        };

        // Helper function to safely stringify objects
        function safeStringify(obj) {
          try {
            if (obj === undefined) return 'undefined';
            if (obj === null) return 'null';
            if (typeof obj === 'object') return JSON.stringify(obj);
            return String(obj);
          } catch (err) {
            return '[Circular or Non-Serializable Object]';
          }
        }

        // Override console methods to capture output
        console.log = function(...args) {
          const message = args.map(safeStringify).join(' ');
          consoleCapture.push({ type: 'log', message, timestamp: new Date().toISOString() });
        };

        console.info = function(...args) {
          const message = args.map(safeStringify).join(' ');
          consoleCapture.push({ type: 'info', message, timestamp: new Date().toISOString() });
        };

        console.warn = function(...args) {
          const message = args.map(safeStringify).join(' ');
          consoleCapture.push({ type: 'warn', message, timestamp: new Date().toISOString() });
        };

        console.error = function(...args) {
          const message = args.map(safeStringify).join(' ');
          consoleCapture.push({ type: 'error', message, timestamp: new Date().toISOString() });
        };

        console.debug = function(...args) {
          const message = args.map(safeStringify).join(' ');
          consoleCapture.push({ type: 'debug', message, timestamp: new Date().toISOString() });
        };

        ${
          collectDebugInfo
            ? `
        // For debug info collection
        const collectDependencyInfo = () => {
          const dependencies = {};
          try {
            const packageJson = require('./package.json');
            if (packageJson.dependencies) {
              Object.keys(packageJson.dependencies).forEach(dep => {
                try {
                  // Try to get the actual version from node_modules
                  const depPackageJson = require(path.join('./node_modules', dep, 'package.json'));
                  dependencies[dep] = depPackageJson.version;
                } catch (err) {
                  dependencies[dep] = packageJson.dependencies[dep] + ' (specified)';
                }
              });
            }
          } catch (err) {
            // No package.json found
          }
          return dependencies;
        };

        // Collect debug info
        const debugInfo = {
          // nodeVersion: process.version,
          // platform: process.platform,
          // arch: process.arch,
          // dependencies: collectDependencyInfo()
        };

        fs.writeFileSync('./debug.json', JSON.stringify(debugInfo));
        `
            : ''
        }

        // Read input data
        const items = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

        // Ensure the module exports a function
        if (typeof userModule !== 'function') {
          throw new Error('The code must export a function');
        }

        // Execute the function
        Promise.resolve()
          .then(() => userModule(items))
          .then(result => {
            // Write result to stdout using original console.log to avoid capture
            originalConsole.log(JSON.stringify({
              success: true,
              data: result,
              console: consoleCapture
            }));
          })
          .catch(error => {
            // Write error to stderr using original console.error to avoid capture
            originalConsole.error(JSON.stringify({
              success: false,
              error: error.message,
              stack: error.stack,
              console: consoleCapture
            }));
          });
      `;

      await fs.writeFile(wrapperFile, wrapperCode);

      // Execute the wrapper script
      return new Promise((resolve, reject) => {
        const process = spawn('node', ['wrapper.js'], {
          cwd: executionDir,
          timeout: timeout || this.defaultTimeout,
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        process.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        process.on('close', async (code) => {
          // Calculate execution time
          const endTime = performance.now();
          const executionTime = (endTime - startTime).toFixed(2);

          let debugInfo = null;

          if (collectDebugInfo) {
            try {
              const debugFileContent = await fs.readFile(debugFile, 'utf8');
              debugInfo = JSON.parse(debugFileContent);

              // Add execution time
              debugInfo.executionTimeMs = parseFloat(executionTime);
            } catch (error) {
              console.error('Error reading debug info:', error);
              debugInfo = { error: 'Failed to collect debug info' };
            }
          }

          if (code !== 0 || stderr) {
            console.error(`Execution failed with code ${code}`);
            try {
              // Try to parse the error from stderr
              const errorData = JSON.parse(stderr);
              if (collectDebugInfo && debugInfo) {
                errorData.debug = debugInfo;
              }
              reject(errorData);
            } catch (e) {
              const errorResponse = {
                success: false,
                error: stderr || 'Unknown execution error',
                console: [], // Include empty console array for consistency
              };
              if (collectDebugInfo && debugInfo) {
                errorResponse.debug = debugInfo;
              }
              reject(errorResponse);
            }
            return;
          }

          try {
            const result = JSON.parse(stdout);
            if (collectDebugInfo && debugInfo) {
              result.debug = debugInfo;
            }

            // Ensure console property exists
            if (!result.console) {
              result.console = [];
            }

            console.log(result);

            resolve(result);
          } catch (error) {
            const errorResponse = {
              success: false,
              error: 'Invalid output format',
              stdout: stdout, // Include the raw stdout in the error response
              console: [], // Include empty console array for consistency
            };
            if (collectDebugInfo && debugInfo) {
              errorResponse.debug = debugInfo;
            }
            reject(errorResponse);
          }
        });

        process.on('error', (error) => {
          const errorResponse = {
            success: false,
            error: error.message,
            console: [], // Include empty console array for consistency
          };
          if (collectDebugInfo) {
            const endTime = performance.now();
            const executionTime = (endTime - startTime).toFixed(2);
            errorResponse.debug = {
              executionTimeMs: parseFloat(executionTime),
              error: 'Process error',
            };
          }
          reject(errorResponse);
        });
      });
    } catch (error) {
      console.error('Error in code execution:', error);
      throw {
        success: false,
        error: error.message,
        console: [], // Include empty console array for consistency
      };
    }
  }

  /**
   * Clean up the execution directory
   */
  async cleanupExecutionDir(executionDir) {
    // If EXECUTIONS_DATA_PRUNE_MAX_COUNT is set to a positive number,
    // we keep the directories and manage them with pruneOldExecutionDirs
    if (this.maxExecutionDirs > 0) {
      // Don't delete the directory, it will be managed by the pruning process
      return;
    }

    try {
      await fs.rm(executionDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Error cleaning up execution directory:', cleanupError);
    }
  }
}

module.exports = ExecutionService;
