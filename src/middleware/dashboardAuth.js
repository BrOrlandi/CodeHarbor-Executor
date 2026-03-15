const crypto = require('crypto');

function generateToken(secretKey) {
  const timestamp = Date.now().toString();
  const hmac = crypto.createHmac('sha256', secretKey).update(timestamp).digest('hex');
  return `${timestamp}.${hmac}`;
}

function verifyToken(token, secretKey) {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [timestamp, hmac] = parts;
  const expectedHmac = crypto.createHmac('sha256', secretKey).update(timestamp).digest('hex');
  if (hmac !== expectedHmac) return false;
  // Token valid for 7 days
  const age = Date.now() - parseInt(timestamp, 10);
  return age < 7 * 24 * 60 * 60 * 1000;
}

function dashboardAuthMiddleware(req, res, next) {
  const secretKey = req.app.get('secretKey');
  if (!secretKey) return next(); // no auth configured

  const token = req.cookies && req.cookies.codeharbor_session;
  if (!verifyToken(token, secretKey)) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  next();
}

module.exports = { dashboardAuthMiddleware, generateToken, verifyToken };
