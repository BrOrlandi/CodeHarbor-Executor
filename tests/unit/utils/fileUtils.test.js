const fs = require('fs/promises');
const path = require('path');
const os = require('os');
const { ensureDirs, getDirectorySize } = require('../../../src/utils/fileUtils');

describe('ensureDirs', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'fileutils-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('creates directories that do not exist', async () => {
    const dir1 = path.join(tmpDir, 'dir1');
    const dir2 = path.join(tmpDir, 'dir2');

    await ensureDirs([dir1, dir2]);

    const stat1 = await fs.stat(dir1);
    const stat2 = await fs.stat(dir2);
    expect(stat1.isDirectory()).toBe(true);
    expect(stat2.isDirectory()).toBe(true);
  });

  it('does not throw if directories already exist', async () => {
    const dir1 = path.join(tmpDir, 'existing');
    await fs.mkdir(dir1);

    await expect(ensureDirs([dir1])).resolves.not.toThrow();
  });
});

describe('getDirectorySize', () => {
  let tmpDir;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dirsize-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('returns 0 for an empty directory', async () => {
    const size = await getDirectorySize(tmpDir);
    expect(size).toBe(0);
  });

  it('calculates size of files in a directory', async () => {
    const content = 'hello world'; // 11 bytes
    await fs.writeFile(path.join(tmpDir, 'file.txt'), content);

    const size = await getDirectorySize(tmpDir);
    expect(size).toBe(11);
  });

  it('calculates size recursively', async () => {
    const subDir = path.join(tmpDir, 'sub');
    await fs.mkdir(subDir);
    await fs.writeFile(path.join(tmpDir, 'a.txt'), 'aaaa'); // 4 bytes
    await fs.writeFile(path.join(subDir, 'b.txt'), 'bb');   // 2 bytes

    const size = await getDirectorySize(tmpDir);
    expect(size).toBe(6);
  });

  it('skips symbolic links', async () => {
    await fs.writeFile(path.join(tmpDir, 'real.txt'), 'data'); // 4 bytes
    await fs.symlink(
      path.join(tmpDir, 'real.txt'),
      path.join(tmpDir, 'link.txt')
    );

    const size = await getDirectorySize(tmpDir);
    expect(size).toBe(4);
  });

  it('returns 0 for a non-existent directory', async () => {
    const size = await getDirectorySize(path.join(tmpDir, 'nonexistent'));
    expect(size).toBe(0);
  });
});
