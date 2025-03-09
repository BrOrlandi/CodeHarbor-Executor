const fs = require('fs/promises');
const path = require('path');
const { exec } = require('child_process');

/**
 * Native Node.js modules that should be excluded from dependencies
 */
const nativeModules = [
  'assert',
  'buffer',
  'child_process',
  'cluster',
  'console',
  'constants',
  'crypto',
  'dgram',
  'dns',
  'domain',
  'events',
  'fs',
  'http',
  'https',
  'module',
  'net',
  'os',
  'path',
  'punycode',
  'querystring',
  'readline',
  'repl',
  'stream',
  'string_decoder',
  'sys',
  'timers',
  'tls',
  'tty',
  'url',
  'util',
  'v8',
  'vm',
  'zlib',
  'process',
];

class DependencyService {
  constructor(cacheService) {
    this.cacheService = cacheService;
  }

  /**
   * Extract dependencies from code
   */
  extractDependencies(code) {
    const dependencies = {};

    // Match both require statements and import statements
    const requireRegex = /require\s*\(\s*['"]([^@\s'"]+)(?:@[^'"]+)?['"]\s*\)/g;
    const importRegex =
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+[^\s]+|[^\s,{}]+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+[^\s]+|[^\s,{}]+))*\s+from\s+)?['"]([^@\s'"]+)(?:@[^'"]+)?['"]/g;

    let match;

    // Extract from require statements
    while ((match = requireRegex.exec(code)) !== null) {
      const packageName = match[1];
      // Exclude native Node.js modules
      if (!this.isNativeModule(packageName)) {
        dependencies[packageName] = 'latest';
      }
    }

    // Extract from import statements
    while ((match = importRegex.exec(code)) !== null) {
      const packageName = match[2];
      // Exclude native Node.js modules
      if (!this.isNativeModule(packageName)) {
        dependencies[packageName] = 'latest';
      }
    }

    return dependencies;
  }

  /**
   * Check if a module is a native Node.js module
   */
  isNativeModule(moduleName) {
    return nativeModules.includes(moduleName);
  }

  /**
   * Get the actual installed versions of dependencies
   */
  async getInstalledVersions(codeDir, dependencies) {
    const packageLockPath = path.join(codeDir, 'package-lock.json');
    const installedDependencies = {};

    try {
      // Check if package-lock.json exists
      const packageLockExists = await fs
        .access(packageLockPath)
        .then(() => true)
        .catch(() => false);

      if (packageLockExists) {
        // Read actual versions from package-lock.json
        const packageLock = JSON.parse(
          await fs.readFile(packageLockPath, 'utf8')
        );

        for (const pkg of Object.keys(dependencies)) {
          if (packageLock.dependencies && packageLock.dependencies[pkg]) {
            installedDependencies[pkg] = packageLock.dependencies[pkg].version;
          } else {
            installedDependencies[pkg] = 'unknown';
          }
        }
      } else {
        // If no package-lock.json, try to get versions from node_modules
        for (const pkg of Object.keys(dependencies)) {
          try {
            const pkgJsonPath = path.join(
              codeDir,
              'node_modules',
              pkg,
              'package.json'
            );
            const pkgJson = JSON.parse(await fs.readFile(pkgJsonPath, 'utf8'));
            installedDependencies[pkg] = pkgJson.version;
          } catch (err) {
            installedDependencies[pkg] = 'unknown';
          }
        }
      }
    } catch (err) {
      console.error('Error getting installed versions:', err);
      // Fallback to using the dependency list without version info
      for (const pkg of Object.keys(dependencies)) {
        installedDependencies[pkg] = 'unknown';
      }
    }

    return installedDependencies;
  }

  /**
   * Install dependencies
   */
  async installDependencies(
    dependencies,
    codeDir,
    cacheKey,
    cachePath,
    forceUpdate = false
  ) {
    // Ensure we have absolute paths for cache and target directories
    const cacheModulesPath = path.join(cachePath, 'node_modules');
    const targetNodeModules = path.join(codeDir, 'node_modules');
    let actualDependencies = {};

    try {
      // If there are no dependencies, just return
      if (Object.keys(dependencies).length === 0) {
        console.log('No dependencies to install');
        return { success: true, dependencies: {} };
      }

      // Check if we already have these dependencies cached and not forcing update
      if (!forceUpdate) {
        const cacheExists = await fs
          .access(cacheModulesPath)
          .then(() => true)
          .catch(() => false);

        if (cacheExists) {
          // Check if all required dependencies exist in the cache
          const missingDependencies = await this.checkForMissingDependencies(
            cacheModulesPath,
            dependencies
          );

          if (missingDependencies.length === 0) {
            console.log(`Using cached dependencies for key: ${cacheKey}`);
            // Create symlink from cache to execution directory
            try {
              await fs.symlink(cacheModulesPath, targetNodeModules);
              // Get the actual versions from the cache
              actualDependencies = await this.getInstalledVersions(
                codeDir,
                dependencies
              );
              return { success: true, dependencies: actualDependencies };
            } catch (error) {
              console.error(
                'Error creating symlink, falling back to copy:',
                error
              );
              // If symlink fails (e.g., on some Windows setups), try copying
              await fs.cp(cacheModulesPath, targetNodeModules, {
                recursive: true,
              });
              actualDependencies = await this.getInstalledVersions(
                codeDir,
                dependencies
              );
              return { success: true, dependencies: actualDependencies };
            }
          } else {
            console.log(
              `Cache exists but missing dependencies: ${missingDependencies.join(
                ', '
              )}. Updating cache...`
            );
            // Continue to installation process to update the cache
          }
        }
      } else {
        console.log('Force update enabled, ignoring cache');
      }

      // Create package.json
      const packageJson = {
        name: 'codeharbor-execution',
        version: '1.0.0',
        dependencies,
      };

      await fs.writeFile(
        path.join(codeDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Install dependencies
      console.log('Installing dependencies:', dependencies);
      return new Promise((resolve, reject) => {
        exec(
          'npm install --production',
          { cwd: codeDir },
          async (error, stdout, stderr) => {
            if (error) {
              console.error(`npm install error: ${error.message}`);
              console.error(`stderr: ${stderr}`);
              return reject(error);
            }

            // Get the actual installed versions
            actualDependencies = await this.getInstalledVersions(
              codeDir,
              dependencies
            );

            // Cache the node_modules for future use if not forcing update
            if (!forceUpdate) {
              try {
                // Clean up old cache if it exists
                const cacheExists = await fs
                  .access(path.dirname(cacheModulesPath))
                  .then(() => true)
                  .catch(() => false);

                if (cacheExists) {
                  await fs.rm(path.dirname(cacheModulesPath), {
                    recursive: true,
                    force: true,
                  });
                }

                // Check and clean up cache if needed before adding new entry
                await this.cacheService.cleanupCache();

                // Create new cache
                await fs.mkdir(path.dirname(cacheModulesPath), {
                  recursive: true,
                });
                await fs.cp(targetNodeModules, cacheModulesPath, {
                  recursive: true,
                });
                console.log(
                  `Dependencies cached successfully with key: ${cacheKey}`
                );
              } catch (cacheError) {
                console.error('Error caching dependencies:', cacheError);
                // Continue even if caching fails
              }
            } else {
              console.log('Skipping cache update due to force update option');
            }

            console.log('Dependencies installed successfully');
            resolve({ success: true, dependencies: actualDependencies });
          }
        );
      });
    } catch (error) {
      console.error('Error in dependency installation:', error);
      throw error;
    }
  }

  /**
   * Check which required dependencies are missing from the cache
   */
  async checkForMissingDependencies(cacheModulesPath, dependencies) {
    const missingDependencies = [];

    for (const pkg of Object.keys(dependencies)) {
      try {
        // Check if the package directory exists in the cache
        await fs.access(path.join(cacheModulesPath, pkg));

        // Additionally verify package.json exists to ensure it's a valid module
        await fs.access(path.join(cacheModulesPath, pkg, 'package.json'));
      } catch (error) {
        // If access fails, the dependency is missing
        missingDependencies.push(pkg);
      }
    }

    return missingDependencies;
  }
}

module.exports = DependencyService;
