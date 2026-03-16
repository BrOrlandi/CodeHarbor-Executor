# CodeHarbor Executor Dockerfile
FROM node:22-slim

# Install Chromium, gosu, and dependencies
RUN apt-get update \
	&& apt-get install -y \
	chromium \
	gosu \
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
ENV DATA_DIR='/home/codeharbor/app/data'
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

# Build dashboard frontend
RUN cd dashboard && pnpm install --no-frozen-lockfile && pnpm build || echo "Dashboard build skipped"

# Create data directory with subdirectories
RUN mkdir -p ${DATA_DIR}/executions ${DATA_DIR}/cache && \
	chown -R codeharbor:codeharbor /home/codeharbor/app

# Adjust ownership of the app directory
RUN chown -R codeharbor:codeharbor /home/codeharbor/app

# Define volume for persistent storage
VOLUME ["${DATA_DIR}"]

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose the application port
EXPOSE 3000

# Entrypoint fixes data dir permissions then drops to codeharbor user
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "index.js"]
