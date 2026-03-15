const authMiddleware = require('../../../src/middleware/auth');

function createMockReqRes(options = {}) {
  const req = {
    path: options.path || '/execute',
    headers: options.headers || {},
    app: {
      get: vi.fn((key) => {
        if (key === 'secretKey') return options.secretKey ?? 'test-secret';
        return undefined;
      }),
    },
  };

  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };

  const next = vi.fn();

  return { req, res, next };
}

describe('authMiddleware - skip paths', () => {
  it('skips auth for /dashboard path', () => {
    const { req, res, next } = createMockReqRes({ path: '/dashboard' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips auth for /dashboard/subpath', () => {
    const { req, res, next } = createMockReqRes({ path: '/dashboard/settings' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips auth for /api/dashboard/login', () => {
    const { req, res, next } = createMockReqRes({ path: '/api/dashboard/login' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips auth for /api/dashboard/jobs', () => {
    const { req, res, next } = createMockReqRes({ path: '/api/dashboard/jobs' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips auth for /api/docs', () => {
    const { req, res, next } = createMockReqRes({ path: '/api/docs' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips auth for /api/docs/subpath', () => {
    const { req, res, next } = createMockReqRes({ path: '/api/docs/swagger.json' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('skips auth for /api/openapi.yaml', () => {
    const { req, res, next } = createMockReqRes({ path: '/api/openapi.yaml' });
    authMiddleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('does NOT skip auth for /execute', () => {
    const { req, res, next } = createMockReqRes({ path: '/execute', secretKey: 'secret' });
    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('does NOT skip auth for /verify-auth', () => {
    const { req, res, next } = createMockReqRes({ path: '/verify-auth', secretKey: 'secret' });
    authMiddleware(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
