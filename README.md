# RegoLab

RegoLab is a modern, interactive playground for developing, testing, and evaluating Open Policy Agent (OPA) Rego policies. It provides a seamless environment to write policies, define input/data JSON, and see evaluation results in real-time.

![RegoLab Screenshot](public/regolab-scrgrb.png)

## Features

- **Interactive Editor**: Syntax highlighting for Rego and JSON.
- **Real-time Evaluation**: Instant feedback from a real OPA server instance.
- **Policy Management**: Create, rename, delete, and download policies.
- **Multi-file Support**: Manage Policy (`policy.rego`), Input (`input.json`), and Data (`data.json`) side-by-side.
- **Dockerized**: Fully containerized for easy deployment and consistency.

## Quick Start

The easiest way to run RegoLab is using Docker. You don't need to install Node.js or OPA locally.

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running.

### Running the App

1. Create a file named `docker-compose.yml` with the following content:

```yaml
version: '3.8'

services:
  backend:
    image: hzmonama/regolab-backend:latest
    ports:
      - "4000:4000"
    volumes:
      - regolab_data:/app/data/policies
    environment:
      - STORAGE_PATH=/app/data/policies
      - CORS_ORIGIN=http://localhost:3000
      - OPA_URL=http://opa:8181
    depends_on:
      - opa

  opa:
    image: openpolicyagent/opa:1.10.1
    ports:
      - "8181:8181"
    command:
      - "run"
      - "--server"
      - "--addr=0.0.0.0:8181"

  frontend:
    image: hzmonama/regolab-frontend:latest
    ports:
      - "3000:3000"
    environment:
      - API_URL=http://backend:4000
      - DOCKER_RUNNING=true
    depends_on:
      - backend

volumes:
  regolab_data:
```

2. Run the application:
   ```bash
   docker-compose up -d
   ```

3. Open your browser and navigate to [http://localhost:3000](http://localhost:3000).


## Architecture

- **Frontend**: Next.js (React) with Tailwind CSS and Shadcn UI.
- **Backend**: Fastify (Node.js) API that manages policy files.
- **OPA**: Official Open Policy Agent container for policy evaluation.

