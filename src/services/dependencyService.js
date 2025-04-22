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
    // Updated regex to handle scoped packages (starting with @)
    const requireRegex = /require\s*\(\s*['"](@?[^'"]+)['"]\s*\)/g;
    const importRegex =
      /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+[^\s]+|[^\s,{}]+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+[^\s]+|[^\s,{}]+))*\s+from\s+)?['"](@?[^'"]+)['"]/g;

    let match;

    // Extract from require statements
    while ((match = requireRegex.exec(code)) !== null) {
      const fullPackageName = match[1];
      // Extract base package name (without version specifier)
      const packageName = this.extractBasePackageName(fullPackageName);

      // Exclude native Node.js modules
      if (!this.isNativeModule(packageName)) {
        dependencies[packageName] = 'latest';
      }
    }

    // Extract from import statements
    while ((match = importRegex.exec(code)) !== null) {
      const fullPackageName = match[2];
      // Extract base package name (without version specifier)
      const packageName = this.extractBasePackageName(fullPackageName);

      // Exclude native Node.js modules
      if (!this.isNativeModule(packageName)) {
        dependencies[packageName] = 'latest';
      }
    }

    return dependencies;
  }

  /**
   * Extract the base package name without version specifier
   */
  extractBasePackageName(fullName) {
    // Handle scoped packages correctly
    if (fullName.startsWith('@')) {
      // For scoped packages, we need to include the scope and package name
      // Format is @scope/package[@version]
      const scopedMatch = fullName.match(/(@[^/]+\/[^@]+)(?:@.+)?/);
      return scopedMatch ? scopedMatch[1] : fullName;
    }

    // For regular packages, just remove version specifier
    const match = fullName.match(/([^@\s'"]+)(?:@.+)?/);
    return match ? match[1] : fullName;
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
    const packageLockPath = path.join(codeDir, 'pnpm-lock.yaml');
    const installedDependencies = {};

    try {
      // First, try to get versions from node_modules directly since pnpm uses a different lock file format
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
   * Configure pnpm store directory
   */
  async configurePnpmStore(codeDir, cachePath) {
    // Configure pnpm to use a store directory within the cache path
    const storeDir = path.join(cachePath, 'pnpm-store');

    try {
      // Create the store directory if it doesn't exist
      await fs.mkdir(storeDir, { recursive: true });

      // Configure pnpm to use this store
      return new Promise((resolve, reject) => {
        exec(
          `pnpm config set store-dir "${storeDir}"`,
          { cwd: codeDir },
          (error, stdout, stderr) => {
            if (error) {
              console.error(`pnpm config error: ${error.message}`);
              console.error(`stderr: ${stderr}`);
              return reject(error);
            }
            console.log(`Configured pnpm store at: ${storeDir}`);
            resolve();
          }
        );
      });
    } catch (error) {
      console.error('Error configuring pnpm store:', error);
      throw error;
    }
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

      // Configure pnpm to use a consistent store directory
      await this.configurePnpmStore(codeDir, cachePath);

      // Install dependencies
      console.log('Installing dependencies:', dependencies);
      return new Promise((resolve, reject) => {
        exec(
          'pnpm install --no-frozen-lockfile',
          { cwd: codeDir },
          async (error, stdout, stderr) => {
            if (error) {
              console.error(`pnpm install error: ${error.message}`);
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
        // For scoped packages, we need to check both the scope dir and the package dir
        if (pkg.startsWith('@')) {
          // For scoped packages like @scope/package
          const [scope, name] = pkg.split('/');
          await fs.access(path.join(cacheModulesPath, scope));
          await fs.access(path.join(cacheModulesPath, scope, name));

          // Additionally verify package.json exists to ensure it's a valid module
          await fs.access(
            path.join(cacheModulesPath, scope, name, 'package.json')
          );
        } else {
          // For regular packages
          await fs.access(path.join(cacheModulesPath, pkg));

          // Additionally verify package.json exists to ensure it's a valid module
          await fs.access(path.join(cacheModulesPath, pkg, 'package.json'));
        }
      } catch (error) {
        // If access fails, the dependency is missing
        missingDependencies.push(pkg);
      }
    }

    return missingDependencies;
  }
}

module.exports = DependencyService;
