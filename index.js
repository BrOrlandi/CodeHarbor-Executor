// CodeHarbor-Executor main entry point
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// Import utilities
const { parseFileSize, formatFileSize } = require('./src/utils/parseUtils');
const { ensureDirs } = require('./src/utils/fileUtils');

// Import services
const CacheService = require('./src/services/cacheService');
const DependencyService = require('./src/services/dependencyService');
const ExecutionService = require('./src/services/executionService');
const DatabaseService = require('./src/services/databaseService');
const JobService = require('./src/services/jobService');
const MigrationService = require('./src/services/migrationService');

// Import controllers and middleware
const ExecutionController = require('./src/controllers/executionController');
const DashboardController = require('./src/controllers/dashboardController');
const authMiddleware = require('./src/middleware/auth');
const setupRoutes = require('./src/routes');
const setupDashboardRoutes = require('./src/routes/dashboardRoutes');

// Environment variables
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || './data';
const EXECUTION_DIR = process.env.EXECUTION_DIR || path.join(DATA_DIR, 'executions');
const CACHE_DIR = process.env.CACHE_DIR || path.join(DATA_DIR, 'cache');
const SECRET_KEY = process.env.SECRET_KEY || '';
const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT || '60000', 10); // 60 seconds default
const CACHE_SIZE_LIMIT = parseFileSize(process.env.CACHE_SIZE_LIMIT || '1GB');

// Consolidate pruning config: EXECUTIONS_DATA_PRUNE_MAX_COUNT is the primary config.
// MAX_JOB_HISTORY is deprecated — use it as fallback if set and primary is not.
const PRUNE_MAX_COUNT = (() => {
  const pruneEnv = process.env.EXECUTIONS_DATA_PRUNE_MAX_COUNT;
  const jobHistoryEnv = process.env.MAX_JOB_HISTORY;
  const parsePruneCount = (raw) => {
    const parsed = parseInt(raw, 10);
    return Number.isNaN(parsed) ? 100 : parsed;
  };

  if (pruneEnv !== undefined) {
    return parsePruneCount(pruneEnv);
  }
  if (jobHistoryEnv !== undefined) {
    console.warn(
      'DEPRECATION WARNING: MAX_JOB_HISTORY is deprecated. Use EXECUTIONS_DATA_PRUNE_MAX_COUNT instead.'
    );
    return parsePruneCount(jobHistoryEnv);
  }
  return 100;
})();

const DEPENDENCY_VERSION_STRATEGY =
  process.env.DEPENDENCY_VERSION_STRATEGY || 'update';
const DASHBOARD_ENABLED =
  process.env.DASHBOARD_ENABLED !== 'false'; // enabled by default

// Initialize express app
const app = express();

// Store config values in app settings for access in middleware and controllers
app.set('secretKey', SECRET_KEY);
app.set('defaultTimeout', DEFAULT_TIMEOUT);
app.set('cacheSizeLimit', CACHE_SIZE_LIMIT);

// Warning for missing SECRET_KEY
if (!SECRET_KEY) {
  console.warn(
    'WARNING: No SECRET_KEY set. Server will run without authentication!'
  );
}

// Setup middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(cookieParser());
app.use(authMiddleware);

// Initialize services
const cacheService = new CacheService(CACHE_DIR, CACHE_SIZE_LIMIT);
const dependencyService = new DependencyService(
  cacheService,
  DEPENDENCY_VERSION_STRATEGY
);
const executionService = new ExecutionService(
  EXECUTION_DIR,
  DEFAULT_TIMEOUT,
  PRUNE_MAX_COUNT
);

// Initialize database and job service
const databaseService = new DatabaseService(DATA_DIR);
const jobService = new JobService(databaseService, PRUNE_MAX_COUNT);

// Initialize controllers
const pkg = require('./package.json');
const executionController = new ExecutionController(
  dependencyService,
  executionService,
  cacheService,
  CACHE_DIR,
  jobService,
  { version: pkg.version }
);

// Setup routes
const router = setupRoutes(app, executionController);
app.use('/', router);

// Dashboard setup
if (DASHBOARD_ENABLED) {
  // Initialize dashboard controller
  const dashboardController = new DashboardController(
    jobService,
    cacheService,
    executionController,
    {
      port: PORT,
      secretKey: SECRET_KEY,
      defaultTimeout: DEFAULT_TIMEOUT,
      cacheSizeLimit: CACHE_SIZE_LIMIT,
      pruneMaxCount: PRUNE_MAX_COUNT,
      dashboardEnabled: DASHBOARD_ENABLED,
      dependencyVersionStrategy: DEPENDENCY_VERSION_STRATEGY,
      dataDir: DATA_DIR,
    }
  );

  // Mount dashboard API routes
  const dashboardRouter = setupDashboardRoutes(dashboardController);
  app.use('/api/dashboard', dashboardRouter);

  // Swagger UI for API docs
  try {
    const swaggerUi = require('swagger-ui-express');
    const YAML = require('yaml');
    const openApiPath = path.join(__dirname, 'openapi.yaml');
    const openApiFile = fs.readFileSync(openApiPath, 'utf8');
    const openApiDoc = YAML.parse(openApiFile);

    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiDoc));
    app.get('/api/openapi.yaml', (req, res) => {
      res.type('text/yaml').send(openApiFile);
    });
  } catch (error) {
    console.warn('Swagger UI not available:', error.message);
  }

  // Serve Vue SPA static files
  const dashboardDistPath = path.join(__dirname, 'dashboard', 'dist');
  // Serve project images at /dashboard/images (used by docs markdown)
  const imagesPath = path.join(__dirname, 'images');
  if (fs.existsSync(imagesPath)) {
    app.use('/dashboard/images', express.static(imagesPath));
  }

  if (fs.existsSync(dashboardDistPath)) {
    app.use('/dashboard', express.static(dashboardDistPath));

    // SPA fallback - serve index.html for any unmatched /dashboard/* routes
    app.get('/dashboard/*', (req, res) => {
      res.sendFile(path.join(dashboardDistPath, 'index.html'));
    });
  }

  console.log('Dashboard enabled');
}

// Migrate old directory layout to unified data/ structure
async function migrateOldDirectories() {
  const fsp = require('fs').promises;
  const oldExecutionsDir = './executions';
  const oldCacheDir = './dependencies-cache';
  const newExecutionsDir = EXECUTION_DIR;
  const newCacheDir = CACHE_DIR;

  // Ensure parent directories exist for custom paths
  await ensureDirs([path.dirname(newExecutionsDir), path.dirname(newCacheDir)]);

  // Migrate old executions/ directory
  if (fs.existsSync(oldExecutionsDir) && !fs.existsSync(newExecutionsDir)) {
    try {
      await fsp.rename(oldExecutionsDir, newExecutionsDir);
      console.log(`Migrated ${oldExecutionsDir} -> ${newExecutionsDir}`);
    } catch (err) {
      console.warn(`Could not migrate ${oldExecutionsDir}: ${err.message}. Please move it manually to ${newExecutionsDir}`);
    }
  }

  // Migrate old dependencies-cache/ directory
  if (fs.existsSync(oldCacheDir) && !fs.existsSync(newCacheDir)) {
    try {
      await fsp.rename(oldCacheDir, newCacheDir);
      console.log(`Migrated ${oldCacheDir} -> ${newCacheDir}`);
    } catch (err) {
      console.warn(`Could not migrate ${oldCacheDir}: ${err.message}. Please move it manually to ${newCacheDir}`);
    }
  }
}

// Start the server
let server;

async function start() {
  try {
    // Ensure base data directory exists before migration
    await ensureDirs([DATA_DIR]);

    // Migrate old directory layout (pre-v2.1) to unified data/ structure
    await migrateOldDirectories();

    // Ensure subdirectories exist (after migration so we don't block rename)
    await ensureDirs([EXECUTION_DIR, CACHE_DIR]);

    // Initialize database
    databaseService.initialize();

    // Recover interrupted jobs from previous run
    jobService.recoverInterruptedJobs();

    // Import legacy executions
    const migrationService = new MigrationService(databaseService, EXECUTION_DIR);
    migrationService.importLegacyExecutions();

    // Perform initial cache cleanup on startup
    await cacheService.cleanupCache();

    server = app.listen(PORT, () => {
      console.log(`CodeHarbor Executor running on port ${PORT}`);
      console.log(`Default execution timeout: ${DEFAULT_TIMEOUT}ms`);
      console.log(`Authentication: ${SECRET_KEY ? 'enabled' : 'disabled'}`);
      console.log(`Cache size limit: ${formatFileSize(CACHE_SIZE_LIMIT)}`);
      console.log(`Data directory: ${DATA_DIR}`);
      console.log(`Pruning max count: ${PRUNE_MAX_COUNT}`);
      console.log(
        `Dependency version strategy: ${DEPENDENCY_VERSION_STRATEGY}`
      );
      console.log(`Dashboard: ${DASHBOARD_ENABLED ? 'enabled' : 'disabled'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
function shutdown() {
  console.log('Shutting down gracefully...');
  const forceTimeout = setTimeout(() => {
    console.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
  forceTimeout.unref();
  if (server) {
    server.close(() => {
      clearTimeout(forceTimeout);
      databaseService.close();
      console.log('Server closed');
      process.exit(0);
    });
  } else {
    clearTimeout(forceTimeout);
    databaseService.close();
    process.exit(0);
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();
