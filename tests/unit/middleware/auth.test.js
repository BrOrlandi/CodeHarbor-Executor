const authMiddleware = require('../../../src/middleware/auth');

function createMockReqRes(options = {}) {
  const req = {
    path: options.path || '/execute',
    headers: options.headers || {},
    app: {
      get: jest.fn((key) => {
        if (key === 'secretKey') return options.secretKey ?? 'test-secret';
        return undefined;
      }),
    },
  };

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  const next = jest.fn();

  return { req, res, next };
}

describe('authMiddleware', () => {
  it('skips auth for /health endpoint', () => {
    const { req, res, next } = createMockReqRes({ path: '/health' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips auth when no SECRET_KEY is configured', () => {
    const { req, res, next } = createMockReqRes({ secretKey: '' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is missing', () => {
    const { req, res, next } = createMockReqRes({ secretKey: 'secret' });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', () => {
    const { req, res, next } = createMockReqRes({
      secretKey: 'secret',
      headers: { authorization: 'Basic abc' },
    });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 403 when token does not match', () => {
    const { req, res, next } = createMockReqRes({
      secretKey: 'secret',
      headers: { authorization: 'Bearer wrong-token' },
    });
    authMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid authentication token',
    });
  });

  it('calls next() when token matches', () => {
    const { req, res, next } = createMockReqRes({
      secretKey: 'secret',
      headers: { authorization: 'Bearer secret' },
    });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
