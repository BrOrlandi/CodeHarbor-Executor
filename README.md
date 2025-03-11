<div align="center">
  <img src="./images/readme_logo.png" alt="CodeHarbor-Executor Logo" width="100%">
</div>

# CodeHarbor-Executor

A Node.js service that provides secure code execution for JavaScript functions with dependency management and caching.

> Run code in n8n with NPM dependencies

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/CodeHarbor-Executor.git

# Navigate to the project directory
cd CodeHarbor-Executor

# Install dependencies
npm install

# Create a .env file (optional)
cp .env.example .env

# Start the server
npm start
```

## Configuration

The service uses dotenv for environment configuration. Create a `.env` file in the root directory with the following variables:

```
PORT=3000
SECRET_KEY=your-secret-key-here
DEFAULT_TIMEOUT=60000
CACHE_SIZE_LIMIT=1GB
```

The following environment variables can be used to configure the service:

- `PORT`: The port on which the service will run (default: 3000)
- `SECRET_KEY`: Authentication token for API calls (default: none)
- `DEFAULT_TIMEOUT`: Default execution timeout in milliseconds (default: 60000)
- `CACHE_SIZE_LIMIT`: Maximum cache directory size with support for human-readable values like "500MB", "1GB", etc. (default: "1GB")

## API

### Execute Code

**Endpoint:** `POST /execute`

**Authentication:**

```
Authorization: Bearer YOUR_SECRET_KEY
```

(Required only if SECRET_KEY is configured)

**Request Body:**

```json
{
  "code": "module.exports = function(items) { console.log('Processing items:', items); return items.map(item => item * 2); }",
  "items": [1, 2, 3, 4, 5],
  "cacheKey": "workflow-123-node-456",
  "options": {
    "timeout": 30000,
    "forceUpdate": false,
    "debug": true
  }
}
```

**Parameters:**

- `code` (required): JavaScript code that exports a function
- `items`: Input data to pass to the function (default: [])
- `cacheKey` (required): Unique identifier for dependency caching
- `options`:
  - `timeout`: Custom execution timeout in milliseconds
  - `forceUpdate`: Force fresh installation of dependencies
  - `debug`: When set to true, returns detailed debug information about the execution

**Response:**

```json
{
  "success": true,
  "data": [2, 4, 6, 8, 10],
  "console": [
    {
      "type": "log",
      "message": "Processing items: [1,2,3,4,5]",
      "timestamp": "2023-06-25T14:30:45.123Z"
    }
  ],
  "debug": {
    "executionTimeMs": 12.34,
    "server": {
      "nodeVersion": "v16.14.0"
    },
    "cache": {
      "usedCache": true,
      "cacheKey": "workflow-123-node-456",
      "currentCacheSize": 5242880,
      "currentCacheSizeFormatted": "5 MB",
      "totalCacheSize": 52428800,
      "totalCacheSizeFormatted": "50 MB"
    },
    "execution": {
      "startTime": "2025-03-10T14:30:45.123Z",
      "installedDependencies": {
        "lodash": "4.17.21"
      },
      "dependencyInstallTimeMs": 345.67,
      "totalResponseTimeMs": 358.01
    }
  }
}
```

**Console Capture**

All console output from the executed code is captured and returned in the `console` property of the response. Each log entry includes:

- `type`: The type of console method used (log, info, warn, error, debug)
- `message`: The content of the log message
- `timestamp`: When the log was generated

This allows you to see all output from the executed code without it interfering with the JSON response format.

### Example curl Request

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-key-here" \
  -d '{
    "code": "module.exports = function(items) { console.log(\"Processing items\"); return items.map(item => item * 2); }",
    "items": [1, 2, 3, 4, 5],
    "cacheKey": "workflow-123-node-456",
    "options": {
      "debug": true
    }
  }'
```

### Example with Dependencies

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-secret-key-here" \
  -d '{
    "code": "const _ = require('\''lodash'\''); module.exports = function(items) { console.log(_.map(items, String)); return _.map(items, item => item * 2); }",
    "items": [1, 2, 3, 4, 5],
    "cacheKey": "workflow-123-node-456"
  }'
```

## Advanced Examples

The following examples demonstrate more complex use cases for CodeHarbor-Executor, showing how to handle binary data processing, image generation, and more.

### Generating Images from Templates

This example shows how to generate meme images using the canvas library:

```javascript
const { createCanvas, loadImage } = require('canvas');

module.exports = async function (items) {
  return Promise.all(
    items.map(async (item) => {
      const text = item.json?.text || 'When CodeHarbor Works!';
      const imageUrl = 'https://i.imgflip.com/30b1gx.jpg'; // Meme template

      const canvas = createCanvas(500, 500);
      const ctx = canvas.getContext('2d');
      const image = await loadImage(imageUrl);

      ctx.drawImage(image, 0, 0, 500, 500);
      ctx.font = '30px Impact';
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.fillText(text, 250, 50);

      const outputBuffer = canvas.toBuffer('image/png');

      return {
        ...item,
        binary: {
          memeImage: {
            data: outputBuffer.toString('base64'),
            mimeType: 'image/png',
            fileName: 'meme.png',
          },
        },
      };
    })
  );
};
```

### Generating PDF Documents

Create dynamic PDF documents from your data:

```javascript
const PDFDocument = require('pdfkit');

module.exports = async function (items) {
  return Promise.all(
    items.map(async (item) => {
      const doc = new PDFDocument();
      const chunks = [];

      doc.text(item.json?.content || 'This is a generated PDF!', {
        align: 'center',
      });
      doc.end();

      return new Promise((resolve) => {
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
          const outputBuffer = Buffer.concat(chunks);

          resolve({
            ...item,
            binary: {
              pdfFile: {
                data: outputBuffer.toString('base64'),
                mimeType: 'application/pdf',
                fileName: 'generated.pdf',
              },
            },
          });
        });
      });
    })
  );
};
```

### Generating QR Code Images

Create QR codes from text input:

```javascript
const QRCode = require('qrcode');
const { createCanvas } = require('canvas');

module.exports = async function (items) {
  return Promise.all(
    items.map(async (item) => {
      const text = item.json?.text || 'CodeHarbor Rocks!';

      // Create QR code as a canvas
      const canvas = createCanvas(300, 300);
      await QRCode.toCanvas(canvas, text, { width: 300 });

      // Get image buffer and convert to base64
      const outputBuffer = canvas.toBuffer('image/png');

      return {
        ...item,
        binary: {
          qrCode: {
            data: outputBuffer.toString('base64'),
            mimeType: 'image/png',
            fileName: 'qrcode.png',
          },
        },
      };
    })
  );
};
```

### Converting Audio Files to MP3

Process and convert audio files using ffmpeg:

```javascript
const ffmpeg = require('fluent-ffmpeg');
const { Readable } = require('stream');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

ffmpeg.setFfmpegPath(ffmpegPath);

module.exports = async function (items) {
  return Promise.all(
    items.map(async (item) => {
      if (!item.binary?.ogaFile) {
        return {
          ...item,
          json: {
            ...item.json,
            error: 'No file provided',
          },
        };
      }

      // Get binary file data
      const inputBuffer = Buffer.from(item.binary.ogaFile.data, 'base64');

      // Create readable stream from buffer
      const inputStream = new Readable();
      inputStream.push(inputBuffer);
      inputStream.push(null);

      // Convert the OGA file to MP3 in memory
      return new Promise((resolve, reject) => {
        const outputChunks = [];

        const command = ffmpeg(inputStream)
          .toFormat('mp3')
          .on('error', (err) => {
            console.error(err);
            resolve({
              ...item,
              json: {
                ...item.json,
                error: 'Conversion failed',
              },
            });
          })
          .on('data', (chunk) => {
            outputChunks.push(chunk);
          })
          .on('end', () => {
            const outputBuffer = Buffer.concat(outputChunks);

            resolve({
              ...item,
              binary: {
                ...item.binary,
                mp3File: {
                  data: outputBuffer.toString('base64'),
                  mimeType: 'audio/mpeg',
                  fileName: item.binary.ogaFile.fileName.replace(
                    '.oga',
                    '.mp3'
                  ),
                },
              },
            });
          });

        command.pipe();
      });
    })
  );
};
```

### Name Generator

Generate unique names using pre-defined dictionaries:

```javascript
const {
  uniqueNamesGenerator,
  starWars,
  animals,
  colors,
} = require('unique-names-generator');

module.exports = async function (items) {
  return items.map((item) => ({
    ...item,
    json: {
      ...item.json,
      fantasyName: uniqueNamesGenerator({ dictionaries: [colors, animals] }),
      starWarsName: uniqueNamesGenerator({ dictionaries: [starWars] }),
    },
  }));
};
```

## Health Check

**Endpoint:** `GET /health`

**Response:**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "auth": "enabled",
  "defaultTimeout": "60000ms"
}
```

## Authentication Verification

**Endpoint:** `GET /verify-auth`

**Authentication:**

```
Authorization: Bearer YOUR_SECRET_KEY
```

(Required only if SECRET_KEY is configured)

**Response:**

```json
{
  "success": true,
  "message": "Authentication successful",
  "authenticated": true
}
```

If authentication fails, the server will return a 401 Unauthorized response.

## Security Considerations

- Authentication via SECRET_KEY environment variable
- Code is executed in isolated environments using Node.js child processes
- Execution timeout prevents infinite loops and long-running processes
- Dependencies are automatically detected and installed from code
- Dependency caching improves performance and reduces npm requests
- Automatic cleanup of execution directories after code runs
- Native Node.js modules detection to prevent unnecessary installations
- Console output is captured and returned as structured data to prevent interference with the execution process

## Using Puppeteer

When using Puppeteer in your code, always configure the launch method with the following parameters to ensure proper execution in the CodeHarbor environment:

```javascript
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/chromium',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  headless: true,
});
```

Example function using Puppeteer:

```javascript
const puppeteer = require('puppeteer');

module.exports = async function (urls) {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  try {
    const page = await browser.newPage();
    const results = [];

    for (const url of urls) {
      await page.goto(url, { waitUntil: 'networkidle2' });
      const title = await page.title();
      results.push({ url, title });
    }

    return results;
  } finally {
    await browser.close();
  }
};
```

## Features

- **Code Execution**: Run JavaScript code with dependencies in a secure environment
- **Dependency Management**: Automatically install and cache required packages
- **Console Capture**: All console output (log, info, warn, error, debug) is captured and returned in the response
- **Execution Timeout**: Prevent infinite loops and long-running processes
- **Caching**: Reuse installed dependencies to improve performance
  - **Smart Cache Verification**: Automatically detects when new dependencies are required and updates the cache accordingly
- **Debug Information**: Optional detailed execution statistics and environment information

# ToDos

- [ ] Prevent installing dependencies in commented code
- [x] Add support for file uploads and binary data handling
- [ ] Online dashboard for monitoring and managing executions
- [ ] Online code editor for writing and testing functions
