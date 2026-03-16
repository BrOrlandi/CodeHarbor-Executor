const { startServer } = require('./setup');

describe('GET /health', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await startServer();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('returns status ok without requiring auth', async () => {
    const res = await fetch(`${ctx.baseUrl}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.version).toBe('2.1.0');
    expect(body.auth).toBe('enabled');
    expect(body).toHaveProperty('defaultTimeout');
  });
});
