// CodeHarbor-Executor main entry point
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');

// Import utilities
const { parseFileSize, formatFileSize } = require('./src/utils/parseUtils');
const { ensureDirs } = require('./src/utils/fileUtils');

// Import services
const CacheService = require('./src/services/cacheService');
const DependencyService = require('./src/services/dependencyService');
const ExecutionService = require('./src/services/executionService');

// Import controllers and middleware
const ExecutionController = require('./src/controllers/executionController');
const authMiddleware = require('./src/middleware/auth');
const setupRoutes = require('./src/routes');

// Environment variables
const PORT = process.env.PORT || 3000;
const EXECUTION_DIR = process.env.EXECUTION_DIR || './executions';
const CACHE_DIR = process.env.CACHE_DIR || './dependencies-cache';
const SECRET_KEY = process.env.SECRET_KEY || '';
const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT || '60000', 10); // 60 seconds default
const CACHE_SIZE_LIMIT = parseFileSize(process.env.CACHE_SIZE_LIMIT || '1GB');
const MAX_EXECUTION_DIRS =
  parseInt(process.env.EXECUTIONS_DATA_PRUNE_MAX_COUNT, 10) || 100;

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
app.use(authMiddleware);

// Initialize services
const cacheService = new CacheService(CACHE_DIR, CACHE_SIZE_LIMIT);
const dependencyService = new DependencyService(cacheService);
const executionService = new ExecutionService(
  EXECUTION_DIR,
  DEFAULT_TIMEOUT,
  MAX_EXECUTION_DIRS
);

// Initialize controller
const executionController = new ExecutionController(
  dependencyService,
  executionService,
  cacheService,
  CACHE_DIR
);

// Setup routes
const router = setupRoutes(app, executionController);
app.use('/', router);

// Start the server
async function start() {
  try {
    // Ensure necessary directories exist
    await ensureDirs([EXECUTION_DIR, CACHE_DIR]);

    // Perform initial cache cleanup on startup
    await cacheService.cleanupCache();

    app.listen(PORT, () => {
      console.log(`CodeHarbor Executor running on port ${PORT}`);
      console.log(`Default execution timeout: ${DEFAULT_TIMEOUT}ms`);
      console.log(`Authentication: ${SECRET_KEY ? 'enabled' : 'disabled'}`);
      console.log(`Cache size limit: ${formatFileSize(CACHE_SIZE_LIMIT)}`);
      console.log(`Maximum execution directories: ${MAX_EXECUTION_DIRS}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
