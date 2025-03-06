// codeharbor-executor/index.js
const express = require('express');
const { exec, spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const EXECUTION_DIR = process.env.EXECUTION_DIR || './executions';
const CACHE_DIR = process.env.CACHE_DIR || './dependencies-cache';

// Middleware
app.use(bodyParser.json({ limit: '50mb' }));

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

// Install dependencies
async function installDependencies(dependencies, codeDir, cacheKey) {
  // Use the provided cache key for the dependencies cache
  const cachePath = path.join(CACHE_DIR, cacheKey, 'node_modules');
  const targetNodeModules = path.join(codeDir, 'node_modules');

  try {
    // Check if we already have these dependencies cached
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

    // If there are no dependencies, just return
    if (Object.keys(dependencies).length === 0) {
      console.log('No dependencies to install');
      return true;
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

          // Cache the node_modules for future use
          try {
            await fs.mkdir(path.join(CACHE_DIR, cacheKey), { recursive: true });
            await fs.cp(targetNodeModules, cachePath, { recursive: true });
            console.log(
              `Dependencies cached successfully with key: ${cacheKey}`
            );
          } catch (cacheError) {
            console.error('Error caching dependencies:', cacheError);
            // Continue even if caching fails
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
async function executeCode(code, items, executionDir) {
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
        timeout: 30000, // 30 second timeout
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
  const { code, items = [], cacheKey } = req.body;

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
    await installDependencies(dependencies, executionDir, cacheKey);

    // Execute the code
    const result = await executeCode(code, items, executionDir);

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
  res.json({ status: 'ok' });
});

// Start the server
async function start() {
  await ensureDirs();
  app.listen(PORT, () => {
    console.log(`CodeHarbor Executor running on port ${PORT}`);
  });
}

start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
