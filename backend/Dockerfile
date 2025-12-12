FROM node:24-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install system dependencies
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Install OPA binary for formatting, testing and eval
RUN wget -O /usr/local/bin/opa https://openpolicyagent.org/downloads/latest/opa_linux_amd64_static \
    && chmod 755 /usr/local/bin/opa

# Install Regal binary for linting
RUN wget -O /usr/local/bin/regal https://github.com/open-policy-agent/regal/releases/download/v0.37.0/regal_Linux_x86_64 \
    && chmod 755 /usr/local/bin/regal

# Copy source code
COPY src/ ./src/

# Copy templates (baked into image)
COPY data/templates/ ./data/templates/

# Copy data sources (baked into image)
COPY data/data-sources/ ./data/data-sources/

# Copy input templates (baked into image)
COPY data/input-templates/ ./data/input-templates/

# Set environment variables for Cloud Run
ENV NODE_ENV=production
ENV PORT=8080

# Expose port (Cloud Run uses 8080 by default)
EXPOSE 8080

# Start command
CMD ["npm", "start"]
