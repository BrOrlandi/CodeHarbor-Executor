const { parseFileSize, formatFileSize } = require('../../../src/utils/parseUtils');

describe('parseFileSize', () => {
  it('parses bytes', () => {
    expect(parseFileSize('100B')).toBe(100);
  });

  it('parses kilobytes', () => {
    expect(parseFileSize('1KB')).toBe(1024);
  });

  it('parses megabytes', () => {
    expect(parseFileSize('500MB')).toBe(500 * 1024 * 1024);
  });

  it('parses gigabytes', () => {
    expect(parseFileSize('1GB')).toBe(1024 * 1024 * 1024);
  });

  it('parses terabytes', () => {
    expect(parseFileSize('2TB')).toBe(2 * 1024 * 1024 * 1024 * 1024);
  });

  it('parses decimal values', () => {
    expect(parseFileSize('1.5GB')).toBe(1.5 * 1024 * 1024 * 1024);
  });

  it('is case insensitive', () => {
    expect(parseFileSize('1gb')).toBe(1024 * 1024 * 1024);
    expect(parseFileSize('1Gb')).toBe(1024 * 1024 * 1024);
  });

  it('returns number as-is if not a string', () => {
    expect(parseFileSize(1024)).toBe(1024);
  });

  it('defaults to 1GB for invalid strings', () => {
    expect(parseFileSize('invalid')).toBe(1073741824);
  });

  it('parses numeric string without unit', () => {
    expect(parseFileSize('2048')).toBe(2048);
  });
});

describe('formatFileSize', () => {
  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 bytes');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(2048)).toBe('2.00 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
  });

  it('formats zero', () => {
    expect(formatFileSize(0)).toBe('0 bytes');
  });
});
