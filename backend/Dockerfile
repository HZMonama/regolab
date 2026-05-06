FROM node:24-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Install system dependencies (Python for opavm)
RUN apt-get update && apt-get install -y python3-pip python3-venv && rm -rf /var/lib/apt/lists/*

# Install opavm
RUN pip3 install opavm --break-system-packages

# Install specific OPA version via opavm (v1.2.0 is current stable)
RUN opavm install 1.2.0 && opavm use 1.2.0

# Install specific Regal version via opavm (v0.38.0 is current stable)
RUN opavm install regal 0.38.0 && opavm use 0.38.0 --tool regal

# Add opavm shims to PATH
ENV PATH="/root/.opavm/shims:${PATH}"

# Copy source code
COPY src/ ./src/

# Copy templates (baked into image)
COPY data/templates/ ./data/templates/

# Copy data sources (baked into image)
COPY data/data-sources/ ./data/data-sources/

# Copy input templates (baked into image)
COPY data/input-templates/ ./data/input-templates/

# Create directory for policies (will be mounted)
RUN mkdir -p ./data/policies

# Expose port
EXPOSE 4000

# Start command
CMD ["npm", "start"]
