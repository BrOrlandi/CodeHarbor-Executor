const fs = require('fs');
const path = require('path');
const os = require('os');
const DatabaseService = require('../../../src/services/databaseService');
const MigrationService = require('../../../src/services/migrationService');

describe('MigrationService', () => {
  let tmpDir;
  let dataDir;
  let execDir;
  let databaseService;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    dataDir = path.join(tmpDir, 'data');
    execDir = path.join(tmpDir, 'executions');

    databaseService = new DatabaseService(dataDir);
    databaseService.initialize();
  });

  afterEach(() => {
    databaseService.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function createExecFolder(name, files = {}) {
    const folderPath = path.join(execDir, name);
    fs.mkdirSync(folderPath, { recursive: true });

    if (files.code) {
      fs.writeFileSync(path.join(folderPath, 'execution.js'), files.code);
    }
    if (files.data) {
      fs.writeFileSync(path.join(folderPath, 'data.json'), JSON.stringify(files.data));
    }
    if (files.packageJson) {
      fs.writeFileSync(path.join(folderPath, 'package.json'), JSON.stringify(files.packageJson));
    }
    if (files.debug) {
      fs.writeFileSync(path.join(folderPath, 'debug.json'), JSON.stringify(files.debug));
    }
    return folderPath;
  }

  it('returns zeros when executions directory does not exist', () => {
    const service = new MigrationService(databaseService, '/nonexistent');
    const result = service.importLegacyExecutions();

    expect(result).toEqual({ imported: 0, skipped: 0 });
  });

  it('returns zeros when no exec-* folders exist', () => {
    fs.mkdirSync(execDir, { recursive: true });
    const service = new MigrationService(databaseService, execDir);
    const result = service.importLegacyExecutions();

    expect(result).toEqual({ imported: 0, skipped: 0 });
  });

  it('ignores non exec-* directories', () => {
    fs.mkdirSync(execDir, { recursive: true });
    fs.mkdirSync(path.join(execDir, 'other-folder'), { recursive: true });

    const service = new MigrationService(databaseService, execDir);
    const result = service.importLegacyExecutions();

    expect(result).toEqual({ imported: 0, skipped: 0 });
  });

  it('imports exec-* folder with all files', () => {
    createExecFolder('exec-1700000000000-abc12', {
      code: 'module.exports = () => 1;',
      data: [{ id: 1 }],
      packageJson: { dependencies: { lodash: '4.17.21' } },
      debug: { someInfo: true },
    });

    const service = new MigrationService(databaseService, execDir);
    const result = service.importLegacyExecutions();

    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(0);

    const db = databaseService.getDb();
    const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get('exec-1700000000000-abc12');

    expect(job).toBeDefined();
    expect(job.status).toBe('imported');
    expect(job.code).toBe('module.exports = () => 1;');
    expect(JSON.parse(job.items)).toEqual([{ id: 1 }]);
    expect(JSON.parse(job.dependencies)).toEqual({ lodash: '4.17.21' });
    expect(job.created_at).toBeDefined();
  });

  it('imports folder with missing optional files', () => {
    createExecFolder('exec-1700000000000-xyz99', {
      code: 'return 1;',
    });

    const service = new MigrationService(databaseService, execDir);
    const result = service.importLegacyExecutions();

    expect(result.imported).toBe(1);

    const db = databaseService.getDb();
    const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get('exec-1700000000000-xyz99');
    expect(job.items).toBeNull();
    expect(job.dependencies).toBeNull();
  });

  it('skips already imported folders', () => {
    createExecFolder('exec-1700000000000-skip1', {
      code: 'return 1;',
    });

    const service = new MigrationService(databaseService, execDir);
    service.importLegacyExecutions();
    const result2 = service.importLegacyExecutions();

    expect(result2.imported).toBe(0);
    expect(result2.skipped).toBe(1);
  });

  it('imports multiple folders', () => {
    createExecFolder('exec-1700000000001-aaa', { code: 'a' });
    createExecFolder('exec-1700000000002-bbb', { code: 'b' });
    createExecFolder('exec-1700000000003-ccc', { code: 'c' });

    const service = new MigrationService(databaseService, execDir);
    const result = service.importLegacyExecutions();

    expect(result.imported).toBe(3);
  });

  it('extracts timestamp from folder name for created_at', () => {
    const timestamp = 1700000000000;
    createExecFolder(`exec-${timestamp}-test`, { code: 'x' });

    const service = new MigrationService(databaseService, execDir);
    service.importLegacyExecutions();

    const db = databaseService.getDb();
    const job = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(`exec-${timestamp}-test`);
    const expectedDate = new Date(timestamp).toISOString().replace('T', ' ').replace('Z', '').split('.')[0];
    expect(job.created_at).toBe(expectedDate);
  });
});
