/**
 * Authentication middleware
 */
function authMiddleware(req, res, next) {
  // Skip auth for health check
  if (req.path === '/health') {
    return next();
  }

  // Skip auth for dashboard static files and SPA
  if (req.path.startsWith('/dashboard')) {
    return next();
  }

  // Skip auth for dashboard API routes (they use cookie-based auth)
  if (req.path.startsWith('/api/dashboard')) {
    return next();
  }

  // Skip auth for API docs
  if (req.path.startsWith('/api/docs') || req.path === '/api/openapi.yaml') {
    return next();
  }

  const SECRET_KEY = req.app.get('secretKey');

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
}

module.exports = authMiddleware;
