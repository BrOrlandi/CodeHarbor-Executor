# CodeHarbor Executor Dockerfile
FROM node:22-slim

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
	build-essential \
	libcairo2-dev \
	libpango1.0-dev \
	libjpeg-dev \
	libgif-dev \
	librsvg2-dev \
	# Add additional dependencies for canvas
	pkg-config \
	python3 \
	libpixman-1-dev \
	--no-install-recommends \
	&& rm -rf /var/lib/apt/lists/*

# Create a non-root user (codeharbor) for running Puppeteer
RUN groupadd -r codeharbor && \
	useradd -r -g codeharbor -G audio,video codeharbor && \
	mkdir -p /home/codeharbor/Downloads && \
	chown -R codeharbor:codeharbor /home/codeharbor

# Set up application directory
WORKDIR /home/codeharbor/app

# Set environment variables
ENV EXECUTION_DIR='/home/codeharbor/app/executions'
ENV CACHE_DIR='/home/codeharbor/app/dependencies-cache'
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV npm_config_build_from_source=true

# Install and enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN corepack prepare pnpm@9.15.4 --activate

# Install dependencies
COPY package*.json ./
RUN pnpm install --no-frozen-lockfile

# Copy app source
COPY . .

# Create directories based on environment variables
RUN mkdir -p ${EXECUTION_DIR} ${CACHE_DIR} && \
	chown -R codeharbor:codeharbor /home/codeharbor/app

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
