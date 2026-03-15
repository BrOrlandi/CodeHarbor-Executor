# Advanced Examples

The following examples demonstrate more complex use cases for CodeHarbor-Executor, showing how to handle binary data processing, image generation, and more.

## Generating Images from Templates

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

## Generating PDF Documents

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

## Generating QR Code Images

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

## Converting Audio Files to MP3

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

## Name Generator

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
