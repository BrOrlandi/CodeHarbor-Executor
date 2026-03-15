const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

class DatabaseService {
  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, 'codeharbor.db');
    this.db = null;
  }

  /**
   * Initialize the database connection and create tables
   */
  initialize() {
    // Ensure data directory exists
    fs.mkdirSync(this.dataDir, { recursive: true });

    this.db = new Database(this.dbPath);

    // Enable WAL mode for better concurrent performance
    this.db.pragma('journal_mode = WAL');

    // Create tables and indices
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error', 'imported', 'interrupted')),
        code TEXT NOT NULL,
        items TEXT,
        cache_key TEXT,
        dependencies TEXT,
        options TEXT,
        console_output TEXT,
        result_data TEXT,
        error_message TEXT,
        error_stack TEXT,
        execution_time_ms REAL,
        dependency_install_time_ms REAL,
        used_cache INTEGER DEFAULT 0,
        request_metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
      CREATE INDEX IF NOT EXISTS idx_jobs_cache_key ON jobs(cache_key);
      CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    `);

    // Migrate: add 'interrupted' status support for existing databases
    this._migrateSchema();

    console.log('Database initialized at', this.dbPath);
    return this;
  }

  /**
   * Migrate schema for existing databases (adds 'interrupted' status)
   */
  _migrateSchema() {
    const checkInfo = this.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='jobs'").get();
    if (checkInfo && checkInfo.sql && !checkInfo.sql.includes('interrupted')) {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS jobs_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          job_id TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'error', 'imported', 'interrupted')),
          code TEXT NOT NULL,
          items TEXT,
          cache_key TEXT,
          dependencies TEXT,
          options TEXT,
          console_output TEXT,
          result_data TEXT,
          error_message TEXT,
          error_stack TEXT,
          execution_time_ms REAL,
          dependency_install_time_ms REAL,
          used_cache INTEGER DEFAULT 0,
          request_metadata TEXT,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT
        );
        INSERT INTO jobs_new SELECT * FROM jobs;
        DROP TABLE jobs;
        ALTER TABLE jobs_new RENAME TO jobs;
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        CREATE INDEX IF NOT EXISTS idx_jobs_cache_key ON jobs(cache_key);
        CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
      `);
      console.log('Database schema migrated: added interrupted status');
    }
  }

  /**
   * Get the database instance
   */
  getDb() {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }
}

module.exports = DatabaseService;
