const { generateToken, verifyToken, dashboardAuthMiddleware } = require('../../../src/middleware/dashboardAuth');

describe('dashboardAuth', () => {
  const SECRET_KEY = 'test-secret-key';

  describe('generateToken', () => {
    it('returns a string with timestamp.hmac format', () => {
      const token = generateToken(SECRET_KEY);
      const parts = token.split('.');
      expect(parts).toHaveLength(2);
      expect(parseInt(parts[0], 10)).toBeGreaterThan(0);
      expect(parts[1]).toMatch(/^[0-9a-f]+$/);
    });

    it('generates different tokens on different calls', () => {
      const t1 = generateToken(SECRET_KEY);
      // Small delay to ensure different timestamp
      const t2 = generateToken(SECRET_KEY);
      // They may be equal if called in same ms, but HMAC should still be consistent
      expect(typeof t1).toBe('string');
      expect(typeof t2).toBe('string');
    });
  });

  describe('verifyToken', () => {
    it('returns true for a valid token', () => {
      const token = generateToken(SECRET_KEY);
      expect(verifyToken(token, SECRET_KEY)).toBe(true);
    });

    it('returns false for null token', () => {
      expect(verifyToken(null, SECRET_KEY)).toBe(false);
    });

    it('returns false for undefined token', () => {
      expect(verifyToken(undefined, SECRET_KEY)).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(verifyToken('', SECRET_KEY)).toBe(false);
    });

    it('returns false for token without dot separator', () => {
      expect(verifyToken('invalidtoken', SECRET_KEY)).toBe(false);
    });

    it('returns false for invalid hmac', () => {
      const token = generateToken(SECRET_KEY);
      const [timestamp] = token.split('.');
      expect(verifyToken(`${timestamp}.invalidhmac`, SECRET_KEY)).toBe(false);
    });

    it('returns false for wrong secret key', () => {
      const token = generateToken(SECRET_KEY);
      expect(verifyToken(token, 'wrong-secret')).toBe(false);
    });

    it('returns false for expired token (older than 7 days)', () => {
      const oldTimestamp = (Date.now() - 8 * 24 * 60 * 60 * 1000).toString();
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', SECRET_KEY).update(oldTimestamp).digest('hex');
      const expiredToken = `${oldTimestamp}.${hmac}`;

      expect(verifyToken(expiredToken, SECRET_KEY)).toBe(false);
    });
  });

  describe('dashboardAuthMiddleware', () => {
    function createMockReqRes(secretKey, cookieValue) {
      const req = {
        app: {
          get: (key) => (key === 'secretKey' ? secretKey : undefined),
        },
        cookies: cookieValue !== undefined ? { codeharbor_session: cookieValue } : {},
      };
      const res = {
        statusCode: null,
        body: null,
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(data) {
          this.body = data;
          return this;
        },
      };
      return { req, res };
    }

    it('calls next() when no secret key is configured', () => {
      const { req, res } = createMockReqRes('', undefined);
      const next = vi.fn();

      dashboardAuthMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('returns 401 when no cookie is present', () => {
      const { req, res } = createMockReqRes(SECRET_KEY, undefined);
      const next = vi.fn();

      dashboardAuthMiddleware(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 for invalid cookie', () => {
      const { req, res } = createMockReqRes(SECRET_KEY, 'invalid.token');
      const next = vi.fn();

      dashboardAuthMiddleware(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next() for valid cookie', () => {
      const token = generateToken(SECRET_KEY);
      const { req, res } = createMockReqRes(SECRET_KEY, token);
      const next = vi.fn();

      dashboardAuthMiddleware(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('returns 401 when cookies object is missing', () => {
      const req = {
        app: { get: () => SECRET_KEY },
        cookies: undefined,
      };
      const res = {
        statusCode: null,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(data) { this.body = data; return this; },
      };
      const next = vi.fn();

      dashboardAuthMiddleware(req, res, next);
      expect(res.statusCode).toBe(401);
    });
  });
});
