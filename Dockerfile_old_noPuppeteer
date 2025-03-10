# CodeHarbor Executor Dockerfile
FROM node:20-slim

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Create directories to match environment variables in docker-compose.yml
RUN mkdir -p /app/cache /tmp/codeharbor

# Copy app source
COPY . .

# Define volume for persistent cache storage
VOLUME ["/app/cache"]

# Expose the port
EXPOSE 3000

# Run the app
CMD ["node", "index.js"]