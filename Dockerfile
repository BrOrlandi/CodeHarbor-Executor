# CodeHarbor Executor Dockerfile
FROM node:20-slim

# Create app directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Create directories for execution and caching
RUN mkdir -p /app/cache /tmp/codeharbor

# Copy app source
COPY . .

# Define volumes for persistent storage
# /app/cache - For dependency caching
# /tmp/codeharbor - For temporary execution (though usually not necessary to persist)
VOLUME ["/app/cache"]

# Expose the port
EXPOSE 3000

# Run the app
CMD ["node", "index.js"]