const fs = require('fs/promises');
const path = require('path');
const { getDirectorySize } = require('../utils/fileUtils');

class CacheService {
  constructor(cacheDir, cacheSizeLimit) {
    this.cacheDir = cacheDir;
    this.cacheSizeLimit = cacheSizeLimit;
  }

  /**
   * Get information about all cache entries
   */
  async getCacheEntries() {
    try {
      const entries = await fs.readdir(this.cacheDir);
      const cacheInfo = [];

      for (const entry of entries) {
        const entryPath = path.join(this.cacheDir, entry);
        const stats = await fs.stat(entryPath);

        if (stats.isDirectory()) {
          const size = await getDirectorySize(entryPath);
          cacheInfo.push({
            key: entry,
            path: entryPath,
            size,
            lastModified: stats.mtime,
          });
        }
      }

      return cacheInfo;
    } catch (error) {
      console.error('Error reading cache directory:', error);
      return [];
    }
  }

  /**
   * Clean up old caches when the total size exceeds the limit
   */
  async cleanupCache() {
    try {
      console.log('Checking cache size...');

      const cacheEntries = await this.getCacheEntries();
      const totalSize = cacheEntries.reduce(
        (sum, entry) => sum + entry.size,
        0
      );

      console.log(
        `Current cache size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`
      );
      console.log(
        `Cache size limit: ${(this.cacheSizeLimit / 1024 / 1024).toFixed(2)} MB`
      );

      if (totalSize > this.cacheSizeLimit) {
        console.log('Cache size exceeds limit, cleaning up old entries...');

        // Sort entries by last modified time (oldest first)
        cacheEntries.sort((a, b) => a.lastModified - b.lastModified);

        let freedSize = 0;
        let sizeToFree =
          totalSize - this.cacheSizeLimit + this.cacheSizeLimit * 0.2; // Free additional 20% to avoid frequent cleanups

        for (const entry of cacheEntries) {
          console.log(
            `Removing cache entry: ${entry.key} (${(
              entry.size /
              1024 /
              1024
            ).toFixed(2)} MB)`
          );
          await fs.rm(entry.path, { recursive: true, force: true });

          freedSize += entry.size;
          if (freedSize >= sizeToFree) {
            break;
          }
        }

        console.log(
          `Freed ${(freedSize / 1024 / 1024).toFixed(2)} MB of cache space`
        );
      }
    } catch (error) {
      console.error('Error cleaning up cache:', error);
    }
  }

  /**
   * Get information about a specific cache entry
   */
  async getCacheEntryInfo(cacheKey) {
    const entryPath = path.join(this.cacheDir, cacheKey);
    try {
      const stats = await fs.stat(entryPath);
      if (stats.isDirectory()) {
        const size = await getDirectorySize(entryPath);
        return {
          key: cacheKey,
          path: entryPath,
          size,
          lastModified: stats.mtime,
          exists: true,
        };
      }
    } catch (error) {
      // Directory doesn't exist or can't be accessed
    }
    return { key: cacheKey, path: entryPath, size: 0, exists: false };
  }
}

module.exports = CacheService;
