/**
 * Parse human-readable file sizes (e.g. "1GB", "500MB") to bytes
 */
function parseFileSize(sizeStr) {
  if (typeof sizeStr !== 'string') {
    return sizeStr;
  }

  const sizeParts = sizeStr.match(/^(\d+(?:\.\d+)?)\s*([KMGT]?B)$/i);
  if (!sizeParts) {
    return parseInt(sizeStr, 10) || 1073741824; // Default to 1GB if invalid
  }

  const size = parseFloat(sizeParts[1]);
  const unit = sizeParts[2].toUpperCase();

  const units = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return size * (units[unit] || 1);
}

/**
 * Format bytes to a human-readable string
 */
function formatFileSize(bytes) {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  } else if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else {
    return `${bytes} bytes`;
  }
}

module.exports = {
  parseFileSize,
  formatFileSize,
};
