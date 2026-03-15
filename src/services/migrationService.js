const fs = require('fs');
const path = require('path');

class MigrationService {
  constructor(databaseService, executionDir = './executions') {
    this.databaseService = databaseService;
    this.executionDir = executionDir;
  }

  /**
   * Import legacy execution folders into the SQLite database
   * Scans ./executions/ for exec-* folders not yet in the DB
   */
  importLegacyExecutions() {
    const db = this.databaseService.getDb();

    // Ensure the execution directory exists
    if (!fs.existsSync(this.executionDir)) {
      console.log('No executions directory found, skipping migration');
      return { imported: 0, skipped: 0 };
    }

    let entries;
    try {
      entries = fs.readdirSync(this.executionDir, { withFileTypes: true });
    } catch (error) {
      console.error('Error reading executions directory:', error);
      return { imported: 0, skipped: 0 };
    }

    const execDirs = entries.filter(
      (entry) => entry.isDirectory() && entry.name.startsWith('exec-')
    );

    if (execDirs.length === 0) {
      console.log('No legacy execution folders found');
      return { imported: 0, skipped: 0 };
    }

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO jobs (job_id, status, code, items, dependencies, request_metadata, created_at)
      VALUES (@job_id, 'imported', @code, @items, @dependencies, @request_metadata, @created_at)
    `);

    let imported = 0;
    let skipped = 0;

    const importAll = db.transaction(() => {
      for (const dir of execDirs) {
        const folderPath = path.join(this.executionDir, dir.name);
        const jobId = dir.name; // e.g. exec-1234567890-abcde

        // Check if already imported
        const existing = db
          .prepare('SELECT 1 FROM jobs WHERE job_id = ?')
          .get(jobId);
        if (existing) {
          skipped++;
          continue;
        }

        try {
          const record = this._readExecutionFolder(folderPath, dir.name);
          insertStmt.run(record);
          imported++;
        } catch (error) {
          console.error(`Error importing ${dir.name}:`, error.message);
          skipped++;
        }
      }
    });

    importAll();

    console.log(
      `Migration complete: ${imported} imported, ${skipped} skipped`
    );
    return { imported, skipped };
  }

  /**
   * Read files from an execution folder and build a job record
   */
  _readExecutionFolder(folderPath, folderName) {
    let code = '';
    let items = null;
    let dependencies = null;
    let requestMetadata = null;

    // Read execution.js -> code
    const executionFile = path.join(folderPath, 'execution.js');
    if (fs.existsSync(executionFile)) {
      code = fs.readFileSync(executionFile, 'utf8');
    }

    // Read data.json -> items
    const dataFile = path.join(folderPath, 'data.json');
    if (fs.existsSync(dataFile)) {
      try {
        items = fs.readFileSync(dataFile, 'utf8');
      } catch {
        // ignore parse errors
      }
    }

    // Read package.json -> dependencies
    const packageFile = path.join(folderPath, 'package.json');
    if (fs.existsSync(packageFile)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
        if (pkg.dependencies) {
          dependencies = JSON.stringify(pkg.dependencies);
        }
      } catch {
        // ignore parse errors
      }
    }

    // Read debug.json -> request_metadata
    const debugFile = path.join(folderPath, 'debug.json');
    if (fs.existsSync(debugFile)) {
      try {
        requestMetadata = fs.readFileSync(debugFile, 'utf8');
      } catch {
        // ignore read errors
      }
    }

    // Extract timestamp from folder name: exec-{timestamp}-{random}
    const parts = folderName.split('-');
    let createdAt;
    if (parts.length >= 2) {
      const timestamp = parseInt(parts[1], 10);
      if (!isNaN(timestamp) && timestamp > 0) {
        createdAt = new Date(timestamp).toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
      }
    }
    if (!createdAt) {
      createdAt = new Date().toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
    }

    return {
      job_id: folderName,
      code: code || '// No code found',
      items,
      dependencies,
      request_metadata: requestMetadata,
      created_at: createdAt,
    };
  }
}

module.exports = MigrationService;
