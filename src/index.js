const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const ExecutionController = require('./controllers/executionController');
const DependencyService = require('./services/dependencyService');
const CacheService = require('./services/cacheService');
const ExecutionService = require('./services/executionService');

// Configuration
const PORT = process.env.PORT || 3000;
const EXECUTION_DIR = process.env.EXECUTION_DIR || '/tmp/codeharbor';
const CACHE_DIR = process.env.CACHE_DIR || './cache';
const DEFAULT_TIMEOUT = parseInt(process.env.DEFAULT_TIMEOUT || '60000', 10);
const SECRET_KEY = process.env.SECRET_KEY;

// Create Express app
const app = express();

// Middleware to parse JSON bodies
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Authentication middleware
const authenticate = (req, res, next) => {
  if (!SECRET_KEY) {
    return next(); // Skip auth if no secret key is set
  }

  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== SECRET_KEY) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  next();
};

// Set app config
app.set('defaultTimeout', DEFAULT_TIMEOUT);
app.set('secretKey', SECRET_KEY);

// Create services
const cacheService = new CacheService(CACHE_DIR);
const dependencyService = new DependencyService(cacheService);
const executionService = new ExecutionService(DEFAULT_TIMEOUT);

// Create controller instance
const executionController = new ExecutionController(
  dependencyService,
  executionService,
  cacheService,
  CACHE_DIR
);

// Routes
app.post('/execute', authenticate, (req, res) =>
  executionController.executeCode(req, res)
);

app.get('/health', (req, res) => executionController.healthCheck(req, res));

app.get('/verify-auth', authenticate, (req, res) =>
  executionController.verifyAuth(req, res)
);

// Start server
app.listen(PORT, () => {
  console.log(`CodeHarbor Executor running on port ${PORT}`);
  console.log(`Execution directory: ${EXECUTION_DIR}`);
  console.log(`Cache directory: ${CACHE_DIR}`);
  console.log(`Default timeout: ${DEFAULT_TIMEOUT}ms`);
  console.log(`Authentication: ${SECRET_KEY ? 'enabled' : 'disabled'}`);
});
