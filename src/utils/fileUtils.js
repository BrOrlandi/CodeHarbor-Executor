const fs = require('fs/promises');
const path = require('path');

/**
 * Ensures that required directories exist
 */
async function ensureDirs(dirs) {
  try {
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    console.log(`Directories created: ${dirs.join(', ')}`);
  } catch (error) {
    console.error('Error creating directories:', error);
  }
}

/**
 * Calculate the size of a directory recursively
 */
async function getDirectorySize(directoryPath) {
  let totalSize = 0;

  try {
    const files = await fs.readdir(directoryPath, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(directoryPath, file.name);

      try {
        // Use lstat to get information about the link itself rather than what it points to
        const stats = await fs.lstat(filePath);

        // Skip symbolic links completely to avoid issues with broken links
        if (stats.isSymbolicLink()) {
          continue;
        }

        if (stats.isDirectory()) {
          const dirSize = await getDirectorySize(filePath);
          totalSize += dirSize;
        } else {
          totalSize += stats.size;
        }
      } catch (fileError) {
        // Handle cases where a file might have been deleted between readdir and stat
        console.error(
          `Error processing file ${filePath}: ${fileError.message}`
        );
        // Continue to next file
        continue;
      }
    }
  } catch (error) {
    // This might happen if the directory no longer exists or is inaccessible
    console.error(
      `Error calculating size of ${directoryPath}: ${error.message}`
    );
  }

  return totalSize;
}

module.exports = {
  ensureDirs,
  getDirectorySize,
};
