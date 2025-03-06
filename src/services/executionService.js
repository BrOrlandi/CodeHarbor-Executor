const fs = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { performance } = require('perf_hooks');

class ExecutionService {
  constructor(executionDir, defaultTimeout) {
    this.executionDir = executionDir;
    this.defaultTimeout = defaultTimeout;
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
    return executionDir;
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
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          dependencies: collectDependencyInfo()
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
            // Write result to stdout
            console.log(JSON.stringify({ success: true, data: result }));
          })
          .catch(error => {
            console.error(JSON.stringify({
              success: false,
              error: error.message,
              stack: error.stack
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

          if (code !== 0) {
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
            resolve(result);
          } catch (error) {
            const errorResponse = {
              success: false,
              error: 'Invalid output format',
            };
            if (collectDebugInfo && debugInfo) {
              errorResponse.debug = debugInfo;
            }
            reject(errorResponse);
          }
        });

        process.on('error', (error) => {
          const errorResponse = { success: false, error: error.message };
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
      throw error;
    }
  }

  /**
   * Clean up the execution directory
   */
  async cleanupExecutionDir(executionDir) {
    try {
      await fs.rm(executionDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Error cleaning up execution directory:', cleanupError);
    }
  }
}

module.exports = ExecutionService;
