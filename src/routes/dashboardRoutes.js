const express = require('express');
const { dashboardAuthMiddleware } = require('../middleware/dashboardAuth');

function setupDashboardRoutes(dashboardController) {
  const router = express.Router();

  // Login/logout - no auth required
  router.post('/login', dashboardController.login.bind(dashboardController));
  router.post('/logout', dashboardController.logout.bind(dashboardController));

  // Protected routes
  router.use(dashboardAuthMiddleware);

  router.get('/jobs', dashboardController.getJobs.bind(dashboardController));
  router.get('/jobs/stats', dashboardController.getJobStats.bind(dashboardController));
  router.get('/jobs/:jobId', dashboardController.getJob.bind(dashboardController));
  router.get('/jobs/:jobId/poll', dashboardController.pollJob.bind(dashboardController));
  router.delete('/jobs/:jobId', dashboardController.deleteJob.bind(dashboardController));
  router.get('/cache', dashboardController.getCacheAnalysis.bind(dashboardController));
  router.get('/info', dashboardController.getInfo.bind(dashboardController));
  router.post('/execute', dashboardController.submitJob.bind(dashboardController));

  return router;
}

module.exports = setupDashboardRoutes;
