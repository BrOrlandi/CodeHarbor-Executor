const fs = require('fs');
const path = require('path');
const os = require('os');
const DatabaseService = require('../../../src/services/databaseService');

describe('DatabaseService', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'db-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('creates the data directory if it does not exist', () => {
      const dataDir = path.join(tmpDir, 'subdir', 'data');
      const service = new DatabaseService(dataDir);
      service.initialize();

      expect(fs.existsSync(dataDir)).toBe(true);

      service.close();
    });

    it('creates the database file', () => {
      const service = new DatabaseService(tmpDir);
      service.initialize();

      expect(fs.existsSync(path.join(tmpDir, 'codeharbor.db'))).toBe(true);

      service.close();
    });

    it('enables WAL journal mode', () => {
      const service = new DatabaseService(tmpDir);
      service.initialize();

      const mode = service.getDb().pragma('journal_mode', { simple: true });
      expect(mode).toBe('wal');

      service.close();
    });

    it('creates the jobs table with expected columns', () => {
      const service = new DatabaseService(tmpDir);
      service.initialize();

      const db = service.getDb();
      const columns = db.prepare("PRAGMA table_info('jobs')").all();
      const columnNames = columns.map(c => c.name);

      expect(columnNames).toContain('id');
      expect(columnNames).toContain('job_id');
      expect(columnNames).toContain('status');
      expect(columnNames).toContain('code');
      expect(columnNames).toContain('items');
      expect(columnNames).toContain('cache_key');
      expect(columnNames).toContain('created_at');
      expect(columnNames).toContain('completed_at');
      expect(columnNames).toContain('execution_time_ms');
      expect(columnNames).toContain('error_message');

      service.close();
    });

    it('creates indices on jobs table', () => {
      const service = new DatabaseService(tmpDir);
      service.initialize();

      const db = service.getDb();
      const indices = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='jobs'").all();
      const indexNames = indices.map(i => i.name);

      expect(indexNames).toContain('idx_jobs_status');
      expect(indexNames).toContain('idx_jobs_cache_key');
      expect(indexNames).toContain('idx_jobs_created_at');

      service.close();
    });

    it('returns this for chaining', () => {
      const service = new DatabaseService(tmpDir);
      const result = service.initialize();
      expect(result).toBe(service);
      service.close();
    });

    it('is idempotent (can be called multiple times)', () => {
      const service = new DatabaseService(tmpDir);
      service.initialize();
      expect(() => service.initialize()).not.toThrow();
      service.close();
    });
  });

  describe('getDb', () => {
    it('returns the database instance after initialization', () => {
      const service = new DatabaseService(tmpDir);
      service.initialize();

      const db = service.getDb();
      expect(db).toBeDefined();
      expect(db).not.toBeNull();

      service.close();
    });

    it('throws when database is not initialized', () => {
      const service = new DatabaseService(tmpDir);
      expect(() => service.getDb()).toThrow('Database not initialized. Call initialize() first.');
    });
  });

  describe('close', () => {
    it('closes the database connection', () => {
      const service = new DatabaseService(tmpDir);
      service.initialize();
      service.close();

      expect(service.db).toBeNull();
    });

    it('does nothing if database is not initialized', () => {
      const service = new DatabaseService(tmpDir);
      expect(() => service.close()).not.toThrow();
    });

    it('makes getDb throw after close', () => {
      const service = new DatabaseService(tmpDir);
      service.initialize();
      service.close();

      expect(() => service.getDb()).toThrow('Database not initialized');
    });
  });
});
