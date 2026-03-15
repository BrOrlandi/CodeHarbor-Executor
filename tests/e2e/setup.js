const path = require('path');
const fs = require('fs/promises');
const os = require('os');

/**
 * Clear require.cache for all project source modules.
 * This ensures each startServer() call gets fresh module instances.
 */
function clearProjectModuleCache() {
  const projectRoot = path.resolve(__dirname, '..', '..');
  Object.keys(require.cache).forEach((key) => {
    if (key.startsWith(path.join(projectRoot, 'src'))) {
      delete require.cache[key];
    }
  });
}

/**
 * Start a real CodeHarbor-Executor server on a random port.
 * Returns { baseUrl, server, tmpDir, cleanup }.
 */
async function startServer(envOverrides = {}) {
  // Create temp dirs for isolation
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codeharbor-e2e-'));
  const executionDir = path.join(tmpDir, 'executions');
  const cacheDir = path.join(tmpDir, 'cache');
  await fs.mkdir(executionDir, { recursive: true });
  await fs.mkdir(cacheDir, { recursive: true });

  // Set env vars before requiring the app modules
  process.env.SECRET_KEY = envOverrides.SECRET_KEY ?? 'e2e-test-secret';
  process.env.DEFAULT_TIMEOUT = envOverrides.DEFAULT_TIMEOUT ?? '10000';
  process.env.CACHE_SIZE_LIMIT = envOverrides.CACHE_SIZE_LIMIT ?? '100MB';
  process.env.EXECUTIONS_DATA_PRUNE_MAX_COUNT = envOverrides.EXECUTIONS_DATA_PRUNE_MAX_COUNT ?? '50';
  process.env.DEPENDENCY_VERSION_STRATEGY = envOverrides.DEPENDENCY_VERSION_STRATEGY ?? 'update';

  // Clear cached modules to get fresh instances
  clearProjectModuleCache();

  // Require modules fresh
  const express = require('express');
  const bodyParser = require('body-parser');
  const { parseFileSize } = require('../../src/utils/parseUtils');
  const CacheService = require('../../src/services/cacheService');
  const DependencyService = require('../../src/services/dependencyService');
  const ExecutionService = require('../../src/services/executionService');
  const ExecutionController = require('../../src/controllers/executionController');
  const authMiddleware = require('../../src/middleware/auth');
  const setupRoutes = require('../../src/routes');

  const app = express();
  app.set('secretKey', process.env.SECRET_KEY);
  app.set('defaultTimeout', parseInt(process.env.DEFAULT_TIMEOUT, 10));
  app.set('cacheSizeLimit', parseFileSize(process.env.CACHE_SIZE_LIMIT));

  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(authMiddleware);

  const cacheService = new CacheService(cacheDir, parseFileSize(process.env.CACHE_SIZE_LIMIT));
  const dependencyService = new DependencyService(cacheService, process.env.DEPENDENCY_VERSION_STRATEGY);
  const executionService = new ExecutionService(executionDir, parseInt(process.env.DEFAULT_TIMEOUT, 10), parseInt(process.env.EXECUTIONS_DATA_PRUNE_MAX_COUNT, 10));
  const executionController = new ExecutionController(dependencyService, executionService, cacheService, cacheDir);

  const router = setupRoutes(app, executionController);
  app.use('/', router);

  // Listen on port 0 to get a random available port
  const server = await new Promise((resolve) => {
    const srv = app.listen(0, () => resolve(srv));
  });

  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  const cleanup = async () => {
    await new Promise((resolve) => server.close(resolve));
    await fs.rm(tmpDir, { recursive: true, force: true });
  };

  return { baseUrl, server, tmpDir, cleanup };
}

module.exports = { startServer };
