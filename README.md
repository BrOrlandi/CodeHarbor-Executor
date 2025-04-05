<div align="center">
  <img src="./images/readme_logo.png" alt="CodeHarbor-Executor Logo" width="100%">
</div>

# CodeHarbor-Executor

A Node.js service that provides secure code execution for JavaScript functions with dependency management and caching.

> Run code in n8n with NPM dependencies

## Installation

This section provides instructions for setting up and running CodeHarbor-Executor.

### Running in Production (Recommended)

The easiest way to run CodeHarbor-Executor in production is using the official Docker image available on Docker Hub.

```bash
# Pull the latest image
docker pull brorlandi/codeharbor-executor:latest

# Run the container
docker run -d \
  --name codeharbor-executor \
  -p 3000:3000 \
  -e SECRET_KEY="your-super-secret-key" \
  -e DEFAULT_TIMEOUT=60000 \
  -e CACHE_SIZE_LIMIT="1GB" \
  -v codeharbor_cache:/app/cache \
  --restart unless-stopped \
  brorlandi/codeharbor-executor:latest
```

**Explanation:**

- `-d`: Run the container in detached mode (in the background).
- `--name codeharbor-executor`: Assign a name to the container.
- `-p 3000:3000`: Map port 3000 on the host to port 3000 in the container.
- `-e SECRET_KEY=...`: **Required:** Set a secure secret key for authentication.
- `-e DEFAULT_TIMEOUT=...`: (Optional) Set the default execution timeout in milliseconds.
- `-e CACHE_SIZE_LIMIT=...`: (Optional) Set the maximum cache size (e.g., "500MB", "2GB").
- `-v codeharbor_cache:/app/cache`: **Recommended:** Mount a Docker volume to persist the dependency cache outside the container. This improves performance and avoids re-downloading dependencies when the container restarts.
- `--restart unless-stopped`: Automatically restart the container unless manually stopped.

Adjust the environment variables (`-e`) as needed based on the [Configuration](#configuration) section.

#### Using Docker Compose

Alternatively, you can use the provided `docker-compose.yml` file to manage the service configuration and deployment more easily:

1.  **Create an environment file:** Copy the `.env.example` to `.env` and configure your `SECRET_KEY` and other settings within the `.env` file.
    ```bash
    cp .env.example .env
    # Edit .env file with your settings
    ```
2.  **Run Docker Compose:**
    ```bash
    docker-compose up -d
    ```

This command will build (if necessary) and start the service based on the settings in `docker-compose.yml` and your `.env` file. The `docker-compose.yml` file already includes the recommended volume mount for the cache.

### Development Setup

If you want to contribute to the project or run it locally for testing purposes, follow these steps:

```bash
# Clone the repository
git clone https://github.com/your-username/CodeHarbor-Executor.git

# Navigate to the project directory
cd CodeHarbor-Executor

# Install dependencies
npm install

# Create a .env file (optional, copy from example)
# Edit this file to set your configuration variables (see Configuration section)
cp .env.example .env

# Start the server
npm start
```

## Configuration

The service uses environment variables for configuration. When running with Docker, pass these using the `-e` flag. When running locally for development, you can create a `.env` file in the root directory.

```dotenv
# .env file content example
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

## Using with n8n

For n8n users, we recommend using the dedicated [n8n-nodes-codeharbor](https://github.com/BrOrlandi/n8n-nodes-codeharbor) custom node. This node provides a seamless integration between n8n workflows and the CodeHarbor-Executor service.

### How it works

1. Add the CodeHarbor node to your n8n workflow
2. Configure the node with your JavaScript code and options
3. The node sends your code and workflow data to the CodeHarbor-Executor service via its REST API
4. CodeHarbor executes the code in a secure environment with the requested NPM dependencies
5. The results are returned to the n8n node, which outputs them to the next node in your workflow

This integration allows you to execute custom JavaScript code with any NPM dependencies directly in your n8n workflows without installing packages on your n8n server.

### Installation Instructions

Follow the installation instructions on the [n8n-nodes-codeharbor](https://github.com/BrOrlandi/n8n-nodes-codeharbor) repository to integrate CodeHarbor with your n8n instance.

## CodeHarbor GPT Agent

To make it even easier to generate code for your CodeHarbor node, a specialized GPT Agent is available in ChatGPT:

<div align="center">
  <a href="https://chatgpt.com/g/g-67cfc39e08b0819188a8101656455aad-codeharbor-code-generator">
    <img src="https://img.shields.io/badge/ChatGPT-CodeHarbor_Generator-74aa9c?style=for-the-badge&logo=openai&logoColor=white" alt="CodeHarbor GPT Agent">
  </a>
</div>

This custom GPT is designed specifically to help you:

- Generate JavaScript code for your CodeHarbor node
- Handle complex data transformations
- Process binary data correctly
- Implement optimized solutions for n8n workflows
- Format code according to CodeHarbor's best practices

Simply describe what you want to achieve in your workflow, and the agent will generate ready-to-use code tailored for CodeHarbor.

[Access the CodeHarbor Code Generator](https://chatgpt.com/g/g-67cfc39e08b0819188a8101656455aad-codeharbor-code-generator)

# ToDos

- [ ] Prevent installing dependencies in commented code
- [x] Add support for file uploads and binary data handling
- [ ] Online dashboard for monitoring and managing executions
- [ ] Online code editor for writing and testing functions
