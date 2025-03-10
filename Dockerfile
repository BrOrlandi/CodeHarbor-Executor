# CodeHarbor Executor Dockerfile
FROM node:20-slim

# Install Chromium and its dependencies
RUN apt-get update \
	&& apt-get install -y \
	chromium \
	fonts-ipafont-gothic \
	fonts-wqy-zenhei \
	fonts-thai-tlwg \
	fonts-kacst \
	fonts-freefont-ttf \
	libxss1 \
	--no-install-recommends \
	&& rm -rf /var/lib/apt/lists/*

# Create a non-root user (codeharbor) for running Puppeteer
RUN groupadd -r codeharbor && \
	useradd -r -g codeharbor -G audio,video codeharbor && \
	mkdir -p /home/codeharbor/Downloads && \
	chown -R codeharbor:codeharbor /home/codeharbor

# Set up application directory
WORKDIR /home/codeharbor/app

# Set default values for environment variables
ENV EXECUTION_DIR='/home/codeharbor/app/executions'
ENV CACHE_DIR='/home/codeharbor/app/dependencies-cache'

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy app source
COPY . .

# Create directories based on environment variables
RUN mkdir -p ${EXECUTION_DIR} ${CACHE_DIR} && \
	chown -R codeharbor:codeharbor ${EXECUTION_DIR} ${CACHE_DIR} /home/codeharbor/app

# Adjust ownership of the app directory
RUN chown -R codeharbor:codeharbor /home/codeharbor/app

# Switch to non-root user
USER codeharbor

# Define volumes for persistent storage
VOLUME ["${CACHE_DIR}", "${EXECUTION_DIR}"]

# Expose the application port
EXPOSE 3000

# Define the command to run your application
CMD ["node", "index.js"]
