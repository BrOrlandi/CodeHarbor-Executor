const { startServer } = require('./setup');

describe('Authentication E2E', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await startServer({ SECRET_KEY: 'e2e-secret' });
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  describe('GET /verify-auth', () => {
    it('returns 401 without Authorization header', async () => {
      const res = await fetch(`${ctx.baseUrl}/verify-auth`);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('returns 403 with wrong token', async () => {
      const res = await fetch(`${ctx.baseUrl}/verify-auth`, {
        headers: { Authorization: 'Bearer wrong' },
      });
      expect(res.status).toBe(403);
    });

    it('returns success with correct token', async () => {
      const res = await fetch(`${ctx.baseUrl}/verify-auth`, {
        headers: { Authorization: 'Bearer e2e-secret' },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.authenticated).toBe(true);
    });
  });

  describe('POST /execute requires auth', () => {
    it('returns 401 without token', async () => {
      const res = await fetch(`${ctx.baseUrl}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'module.exports = () => 1', cacheKey: 'test' }),
      });
      expect(res.status).toBe(401);
    });
  });
});
