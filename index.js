// codeharbor-executor/index.js
require('dotenv').config();
const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const EXECUTION_DIR = process.env.EXECUTION_DIR || './executions';
const CACHE_DIR = process.env.CACHE_DIR || './dependencies-cache';
const SECRET_KEY = process.env.SECRET_KEY || '';
const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT || '60000', 10); // 60 seconds default

// Function to parse human-readable file sizes
function parseFileSize(sizeStr) {
  if (typeof sizeStr !== 'string') {
    return sizeStr;
  }

  const sizeParts = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
  if (!sizeParts) {
    return parseInt(sizeStr, 10) || 1073741824; // Default to 1GB if invalid
  }

  const size = parseFloat(sizeParts[1]);
  const unit = sizeParts[2].toUpperCase();

  const units = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return size * (units[unit] || 1);
}

// Parse CACHE_SIZE_LIMIT with support for human-readable sizes
const CACHE_SIZE_LIMIT = parseFileSize(process.env.CACHE_SIZE_LIMIT || '1GB');

if (!SECRET_KEY) {
  console.warn(
    'WARNING: No SECRET_KEY set. Server will run without authentication!'
  );
}

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));

// Authentication middleware
app.use((req, res, next) => {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  // Skip auth if no secret key is configured
  if (!SECRET_KEY) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  const token = authHeader.split(' ')[1];

  if (token !== SECRET_KEY) {
    return res.status(403).json({
      success: false,
      error: 'Invalid authentication token',
    });
  }

  next();
});

// Ensure directories exist
async function ensureDirs() {
  try {
    await fs.mkdir(EXECUTION_DIR, { recursive: true });
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log(`Directories created: ${EXECUTION_DIR}, ${CACHE_DIR}`);
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

// Extract dependencies from code
function extractDependencies(code) {
  const dependencies = {};

  // Match both require statements and import statements
  const requireRegex = /require\s*\(\s*['"]([^@\s'"]+)(?:@[^'"]+)?['"]\s*\)/g;
  const importRegex =
    /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+[^\s]+|[^\s,{}]+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+[^\s]+|[^\s,{}]+))*\s+from\s+)?['"]([^@\s'"]+)(?:@[^'"]+)?['"]/g;

  let match;

  // Extract from require statements
  while ((match = requireRegex.exec(code)) !== null) {
    const packageName = match[1];
    // Exclude native Node.js modules
    if (!isNativeModule(packageName)) {
      dependencies[packageName] = 'latest';
    }
  }

  // Extract from import statements
  while ((match = importRegex.exec(code)) !== null) {
    const packageName = match[2];
    // Exclude native Node.js modules
    if (!isNativeModule(packageName)) {
      dependencies[packageName] = 'latest';
    }
  }

  return dependencies;
}

// Check if a module is a native Node.js module
function isNativeModule(moduleName) {
  const nativeModules = [
    'assert',
    'buffer',
    'child_process',
    'cluster',
    'console',
    'constants',
    'crypto',
    'dgram',
    'dns',
    'domain',
    'events',
    'fs',
    'http',
    'https',
    'module',
    'net',
    'os',
    'path',
    'punycode',
    'querystring',
    'readline',
    'repl',
    'stream',
    'string_decoder',
    'sys',
    'timers',
    'tls',
    'tty',
    'url',
    'util',
    'v8',
    'vm',
    'zlib',
    'process',
  ];

  return nativeModules.includes(moduleName);
}

// Calculate the size of a directory recursively
async function getDirectorySize(directoryPath) {
  let totalSize = 0;

  try {
    const files = await fs.readdir(directoryPath);

    for (const file of files) {
      const filePath = path.join(directoryPath, file);
      const stats = await fs.stat(filePath);

      if (stats.isDirectory()) {
        totalSize += await getDirectorySize(filePath);
      } else {
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error(`Error calculating size of ${directoryPath}:`, error);
  }

  return totalSize;
}

// Get cache entry information with metadata
async function getCacheEntries() {
  try {
    const entries = await fs.readdir(CACHE_DIR);
    const cacheInfo = [];

    for (const entry of entries) {
      const entryPath = path.join(CACHE_DIR, entry);
      const stats = await fs.stat(entryPath);

      if (stats.isDirectory()) {
        const size = await getDirectorySize(entryPath);
        cacheInfo.push({
          key: entry,
          path: entryPath,
          size,
          lastModified: stats.mtime,
        });
      }
    }

    return cacheInfo;
  } catch (error) {
    console.error('Error reading cache directory:', error);
    return [];
  }
}

// Clean up old caches when the total size exceeds the limit
async function cleanupCache() {
  try {
    console.log('Checking cache size...');

    const cacheEntries = await getCacheEntries();
    const totalSize = cacheEntries.reduce((sum, entry) => sum + entry.size, 0);

    console.log(
      `Current cache size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(
      `Cache size limit: ${(CACHE_SIZE_LIMIT / 1024 / 1024).toFixed(2)} MB`
    );

    if (totalSize > CACHE_SIZE_LIMIT) {
      console.log('Cache size exceeds limit, cleaning up old entries...');

      // Sort entries by last modified time (oldest first)
      cacheEntries.sort((a, b) => a.lastModified - b.lastModified);

      let freedSize = 0;
      let sizeToFree = totalSize - CACHE_SIZE_LIMIT + CACHE_SIZE_LIMIT * 0.2; // Free additional 20% to avoid frequent cleanups

      for (const entry of cacheEntries) {
        console.log(
          `Removing cache entry: ${entry.key} (${(
            entry.size /
            1024 /
            1024
          ).toFixed(2)} MB)`
        );
        await fs.rm(entry.path, { recursive: true, force: true });

        freedSize += entry.size;
        if (freedSize >= sizeToFree) {
          break;
        }
      }

      console.log(
        `Freed ${(freedSize / 1024 / 1024).toFixed(2)} MB of cache space`
      );
    }
  } catch (error) {
    console.error('Error cleaning up cache:', error);
  }
}

// Install dependencies
async function installDependencies(
  dependencies,
  codeDir,
  cacheKey,
  forceUpdate = false
) {
  // Use the provided cache key for the dependencies cache
  // Ensure we have absolute paths for cache and target directories
  const cachePath = path.join(
    path.resolve(CACHE_DIR),
    cacheKey,
    'node_modules'
  );
  const targetNodeModules = path.join(codeDir, 'node_modules');

  console.log({ cachePath, targetNodeModules });

  try {
    // If there are no dependencies, just return
    if (Object.keys(dependencies).length === 0) {
      console.log('No dependencies to install');
      return true;
    }

    // Check if we already have these dependencies cached and not forcing update
    if (!forceUpdate) {
      const cacheExists = await fs
        .access(cachePath)
        .then(() => true)
        .catch(() => false);

      if (cacheExists) {
        console.log(`Using cached dependencies for key: ${cacheKey}`);
        // Create symlink from cache to execution directory
        try {
          await fs.symlink(cachePath, targetNodeModules);
          return true;
        } catch (error) {
          console.error('Error creating symlink, falling back to copy:', error);
          // If symlink fails (e.g., on some Windows setups), try copying
          await fs.cp(cachePath, targetNodeModules, { recursive: true });
          return true;
        }
      }
    } else {
      console.log('Force update enabled, ignoring cache');
    }

    // Create package.json
    const packageJson = {
      name: 'codeharbor-execution',
      version: '1.0.0',
      dependencies,
    };

    await fs.writeFile(
      path.join(codeDir, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Install dependencies
    console.log('Installing dependencies:', dependencies);
    return new Promise((resolve, reject) => {
      exec(
        'npm install --production',
        { cwd: codeDir },
        async (error, stdout, stderr) => {
          if (error) {
            console.error(`npm install error: ${error.message}`);
            console.error(`stderr: ${stderr}`);
            return reject(error);
          }

          // Cache the node_modules for future use if not forcing update
          if (!forceUpdate) {
            try {
              // Clean up old cache if it exists
              const cacheExists = await fs
                .access(path.join(CACHE_DIR, cacheKey))
                .then(() => true)
                .catch(() => false);

              if (cacheExists) {
                await fs.rm(path.join(CACHE_DIR, cacheKey), {
                  recursive: true,
                  force: true,
                });
              }

              // Check and clean up cache if needed before adding new entry
              await cleanupCache();

              // Create new cache
              await fs.mkdir(path.join(CACHE_DIR, cacheKey), {
                recursive: true,
              });
              await fs.cp(targetNodeModules, cachePath, { recursive: true });
              console.log(
                `Dependencies cached successfully with key: ${cacheKey}`
              );
            } catch (cacheError) {
              console.error('Error caching dependencies:', cacheError);
              // Continue even if caching fails
            }
          } else {
            console.log('Skipping cache update due to force update option');
          }

          console.log('Dependencies installed successfully');
          resolve(true);
        }
      );
    });
  } catch (error) {
    console.error('Error in dependency installation:', error);
    throw error;
  }
}

// Execute code in a sandboxed environment
async function executeCode(code, items, executionDir, timeout) {
  const executionFile = path.join(executionDir, 'execution.js');
  const dataFile = path.join(executionDir, 'data.json');
  const wrapperFile = path.join(executionDir, 'wrapper.js');

  try {
    // Write the user code to a file
    await fs.writeFile(executionFile, code);

    // Write the input data to a file
    await fs.writeFile(dataFile, JSON.stringify(items));

    // Create a wrapper script that will import the user code and execute it
    const wrapperCode = `
      const userModule = require('./execution.js');
      const fs = require('fs');

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
        timeout: timeout || DEFAULT_TIMEOUT,
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code !== 0) {
          console.error(`Execution failed with code ${code}`);
          try {
            // Try to parse the error from stderr
            const errorData = JSON.parse(stderr);
            reject(errorData);
          } catch (e) {
            reject({
              success: false,
              error: stderr || 'Unknown execution error',
            });
          }
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (error) {
          reject({ success: false, error: 'Invalid output format' });
        }
      });

      process.on('error', (error) => {
        reject({ success: false, error: error.message });
      });
    });
  } catch (error) {
    console.error('Error in code execution:', error);
    throw error;
  }
}

// API endpoint to execute code
app.post('/execute', async (req, res) => {
  const { code, items = [], cacheKey, options = {} } = req.body;

  if (!code) {
    return res.status(400).json({ success: false, error: 'Code is required' });
  }

  if (!cacheKey) {
    return res.status(400).json({
      success: false,
      error:
        'Cache key is required (should be a hash of workflow ID and node name)',
    });
  }

  // Extract options
  const executionTimeout = options.timeout || DEFAULT_TIMEOUT;
  const forceUpdate = options.forceUpdate || false;

  // Log execution request
  console.log(
    `Execution request: cacheKey=${cacheKey}, timeout=${executionTimeout}ms, forceUpdate=${forceUpdate}`
  );

  // Extract dependencies from the code
  const dependencies = extractDependencies(code);
  console.log('Extracted dependencies:', dependencies);

  // Create a unique execution directory
  const executionId = `exec-${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 7)}`;
  const executionDir = path.join(EXECUTION_DIR, executionId);

  try {
    await fs.mkdir(executionDir, { recursive: true });

    // Install dependencies if any
    await installDependencies(
      dependencies,
      executionDir,
      cacheKey,
      forceUpdate
    );

    // Execute the code
    const result = await executeCode(
      code,
      items,
      executionDir,
      executionTimeout
    );

    // Clean up the execution directory
    fs.rm(executionDir, { recursive: true, force: true }).catch((error) =>
      console.error('Error cleaning up execution directory:', error)
    );

    res.json(result);
  } catch (error) {
    console.error('Error processing request:', error);

    // Clean up the execution directory
    fs.rm(executionDir, { recursive: true, force: true }).catch(
      (cleanupError) =>
        console.error('Error cleaning up execution directory:', cleanupError)
    );

    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '1.0.0',
    auth: SECRET_KEY ? 'enabled' : 'disabled',
    defaultTimeout: `${DEFAULT_TIMEOUT}ms`,
  });
});

// Start the server
async function start() {
  await ensureDirs();
  await cleanupCache(); // Initial cache cleanup on startup

  app.listen(PORT, () => {
    console.log(`CodeHarbor Executor running on port ${PORT}`);
    console.log(`Default execution timeout: ${DEFAULT_TIMEOUT}ms`);
    console.log(`Authentication: ${SECRET_KEY ? 'enabled' : 'disabled'}`);

    // Format the cache size for display
    let displaySize;
    if (CACHE_SIZE_LIMIT >= 1024 * 1024 * 1024) {
      displaySize = `${(CACHE_SIZE_LIMIT / 1024 / 1024 / 1024).toFixed(2)} GB`;
    } else if (CACHE_SIZE_LIMIT >= 1024 * 1024) {
      displaySize = `${(CACHE_SIZE_LIMIT / 1024 / 1024).toFixed(2)} MB`;
    } else if (CACHE_SIZE_LIMIT >= 1024) {
      displaySize = `${(CACHE_SIZE_LIMIT / 1024).toFixed(2)} KB`;
    } else {
      displaySize = `${CACHE_SIZE_LIMIT} bytes`;
    }

    console.log(`Cache size limit: ${displaySize}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
