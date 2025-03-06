const express = require('express');

function setupRoutes(app, executionController) {
  const router = express.Router();

  // Execute code endpoint
  router.post(
    '/execute',
    executionController.executeCode.bind(executionController)
  );

  // Health check endpoint
  router.get(
    '/health',
    executionController.healthCheck.bind(executionController)
  );

  // Auth verification endpoint
  router.get(
    '/verify-auth',
    executionController.verifyAuth.bind(executionController)
  );

  return router;
}

module.exports = setupRoutes;
