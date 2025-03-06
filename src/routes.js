const express = require('express');

function setupRoutes(app, executionController) {
  const router = express.Router();

  // API endpoint to execute code
  router.post('/execute', (req, res) =>
    executionController.executeCode(req, res)
  );

  // Health check endpoint
  router.get('/health', (req, res) =>
    executionController.healthCheck(req, res)
  );

  return router;
}

module.exports = setupRoutes;
