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
    const pkg = require('../../package.json');
    expect(body.version).toBe(pkg.version);
    expect(body.auth).toBe('enabled');
    expect(body).toHaveProperty('defaultTimeout');
  });
});
