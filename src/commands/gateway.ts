// Gateway command - create and manage the FaaS API Gateway

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'
import logger from '../utils/logger'
import * as docker from '../utils/docker'

const GATEWAY_DIR = 'faas-gateway'
const GATEWAY_IMAGE = 'faas-gateway:latest'
const GATEWAY_CONTAINER = 'faas-gateway'
const FAAS_NETWORK = 'faas-network'

// Nginx configuration template with token auth and dynamic routing
// Uses envsubst to inject FAAS_AUTH_TOKEN at container startup
const NGINX_CONF_TEMPLATE = `# FaaS Gateway - Nginx configuration with token authentication
# Routes requests to function containers on the faas-network
# FAAS_AUTH_TOKEN and FAAS_AUTH_ENABLED are injected via envsubst at container startup

worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent"';

    access_log /var/log/nginx/access.log main;

    sendfile on;
    keepalive_timeout 65;

    # Resolver for Docker DNS (container names)
    resolver 127.0.0.11 valid=10s ipv6=off;

    # Map to validate the Authorization header against the expected token
    # FAAS_AUTH_TOKEN is substituted by envsubst at startup
    map $http_authorization $auth_valid {
        default                         0;
        "Bearer \${FAAS_AUTH_TOKEN}"    1;
    }

    # FAAS_AUTH_ENABLED is set to "0" or "1" by start.sh (never empty)
    map \${FAAS_AUTH_ENABLED} $auth_required {
        default 0;
        "1"     1;
    }

    server {
        listen 80;
        listen [::]:80;
        listen 8080;
        listen [::]:8080;
        server_name _;

        # Health check endpoint (no auth required)
        location = /health {
            default_type text/plain;
            return 200 'OK';
        }

        # List available info
        location = / {
            default_type application/json;
            return 200 '{"service": "faas-gateway", "usage": "GET /<container-name>[/path]"}';
        }

        # All other requests route to containers by name
        # URL: /<container-name>[/optional/path]
        location ~ ^/([a-zA-Z0-9_-]+)(.*)$ {
            set $container_name $1;
            set $container_path $2;

            # default_type must be at location level (not inside if)
            default_type application/json;

            # Check authentication (if token is configured)
            set $auth_check "$auth_required:$auth_valid";

            # If auth is required (1) and token is invalid (0), return 401
            if ($auth_check = "1:0") {
                return 401 '{"error": "Unauthorized - Invalid or missing Bearer token"}';
            }

            # Proxy to the container on the Docker network
            proxy_pass http://$container_name:8080$container_path$is_args$args;
            proxy_http_version 1.1;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_set_header Connection "";
            proxy_connect_timeout 10s;
            proxy_read_timeout 60s;
            proxy_send_timeout 60s;

            # Handle upstream errors
            proxy_intercept_errors on;
            error_page 502 503 504 = @upstream_error;
        }

        # Error handler for upstream failures
        location @upstream_error {
            default_type application/json;
            return 502 '{"error": "Function not found or not running", "container": "$container_name"}';
        }
    }
}
`

// Dockerfile for the gateway - pure nginx, no Go needed
const DOCKERFILE = `# FaaS Gateway - Pure Nginx with token authentication
FROM nginx:alpine

LABEL faas.gateway="true"

# Copy nginx config template
COPY nginx.conf.template /etc/nginx/nginx.conf.template

# Copy startup script
COPY start.sh /start.sh
RUN chmod +x /start.sh

EXPOSE 8080

# Default to empty token (open mode)
ENV FAAS_AUTH_TOKEN=""

CMD ["/start.sh"]
`

// Startup script - uses envsubst to inject token into nginx config
const START_SCRIPT = `#!/bin/sh
set -e

# Compute auth enabled flag (always "0" or "1", never empty)
if [ -z "$FAAS_AUTH_TOKEN" ]; then
    export FAAS_AUTH_ENABLED=0
    echo "FaaS Gateway starting in OPEN mode (no authentication)"
else
    export FAAS_AUTH_ENABLED=1
    echo "FaaS Gateway starting with token authentication enabled"
fi

# Substitute environment variables into nginx config
# Only substitute these two to avoid breaking nginx variables like $host, $remote_addr etc.
envsubst '\${FAAS_AUTH_TOKEN} \${FAAS_AUTH_ENABLED}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Start nginx
exec nginx -g 'daemon off;'
`

// Docker compose for easy local testing
const DOCKER_COMPOSE = `version: '3.8'

services:
  gateway:
    build: .
    container_name: faas-gateway
    ports:
      - "8080:8080"
    environment:
      - FAAS_AUTH_TOKEN=\${FAAS_AUTH_TOKEN:-}
    networks:
      - faas-network
    restart: unless-stopped
    labels:
      - faas.gateway=true

networks:
  faas-network:
    name: faas-network
    external: true
`

const README = `# FaaS Gateway

A lightweight API gateway for your FaaS functions with token authentication.
Uses pure nginx - no additional dependencies.

## Quick Start

\`\`\`bash
# Create the Docker network
docker network create faas-network

# Build the gateway
docker build -t faas-gateway .

# Run with authentication
docker run -d \\
  --name faas-gateway \\
  --network faas-network \\
  -p 8080:8080 \\
  -e FAAS_AUTH_TOKEN=your-secret-token \\
  faas-gateway

# Or run in open mode (no auth)
docker run -d \\
  --name faas-gateway \\
  --network faas-network \\
  -p 8080:8080 \\
  faas-gateway
\`\`\`

## Usage

Call your functions through the gateway:

\`\`\`bash
# With authentication
curl -H "Authorization: Bearer your-secret-token" \\
  http://localhost:8080/my-function-name

# The path after the function name is forwarded
curl -H "Authorization: Bearer your-secret-token" \\
  http://localhost:8080/my-function-name/api/users

# Health check (no auth required)
curl http://localhost:8080/health
\`\`\`

## Deploying Functions

Make sure your function containers:
1. Are on the \`faas-network\` Docker network
2. Have a container name matching the URL path

\`\`\`bash
# Example: Deploy a function named "hello"
docker run -d \\
  --name hello \\
  --network faas-network \\
  --label faas.fn=true \\
  my-hello-function:latest

# Call it through the gateway
curl -H "Authorization: Bearer token" http://localhost:8080/hello
\`\`\`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| \`FAAS_AUTH_TOKEN\` | Bearer token for authentication. If empty, gateway runs in open mode. | (empty) |

## How It Works

1. Requests come in to \`http://gateway:8080/<container-name>/path\`
2. If \`FAAS_AUTH_TOKEN\` is set, validates \`Authorization: Bearer <token>\` header
3. Proxies request to \`http://<container-name>:8080/path\` on the Docker network
4. Returns response from the function container

## Production Deployment

Deploy the gateway as a Docker container on your server. For HTTPS and domain management,
use \`faas proxy init\` to set up a Caddy reverse proxy in front of the gateway.

\`\`\`bash
# On your server
docker network create faas-network
docker build -t faas-gateway .
docker run -d \\
  --name faas-gateway \\
  --network faas-network \\
  -p 8080:8080 \\
  -e FAAS_AUTH_TOKEN=your-secret-token \\
  --restart unless-stopped \\
  faas-gateway
\`\`\`

Or use docker-compose:

\`\`\`bash
# Set your token
export FAAS_AUTH_TOKEN=your-secret-token

# Create network and start
docker network create faas-network
docker compose up -d
\`\`\`
`

export interface GatewayOptions {
  output?: string
}

export async function gatewayInit(
  options: GatewayOptions = {},
): Promise<boolean> {
  const outputDir = options.output || GATEWAY_DIR
  const targetDir = resolve(process.cwd(), outputDir)

  logger.title('Creating FaaS Gateway')

  if (existsSync(targetDir)) {
    logger.error(`Directory already exists: ${outputDir}`)
    return false
  }

  // Create directory
  mkdirSync(targetDir, { recursive: true })

  // Write files
  const files = {
    'nginx.conf.template': NGINX_CONF_TEMPLATE.trim(),
    Dockerfile: DOCKERFILE.trim(),
    'start.sh': START_SCRIPT.trim(),
    'docker-compose.yml': DOCKER_COMPOSE.trim(),
    'README.md': README.trim(),
  }

  for (const [filename, content] of Object.entries(files)) {
    const filePath = join(targetDir, filename)
    writeFileSync(filePath, content)
    logger.success(`Created ${filename}`)
  }

  logger.newline()
  logger.success(`Gateway created in ${outputDir}/`)
  logger.newline()
  logger.info('Next steps:')
  logger.dim(`  cd ${outputDir}`)
  logger.dim('  docker network create faas-network')
  logger.dim('  docker build -t faas-gateway .')
  logger.dim(
    '  docker run -d --name faas-gateway --network faas-network -p 8080:8080 -e FAAS_AUTH_TOKEN=secret faas-gateway',
  )
  logger.newline()

  return true
}

export async function gatewayBuild(
  options: GatewayOptions = {},
): Promise<boolean> {
  const gatewayDir = options.output || GATEWAY_DIR
  const targetDir = resolve(process.cwd(), gatewayDir)

  logger.title('Building FaaS Gateway')

  if (!existsSync(targetDir)) {
    logger.error(`Gateway directory not found: ${gatewayDir}`)
    logger.info('Run "faas gateway init" first to create the gateway')
    return false
  }

  // Check Docker
  if (!(await docker.isDockerAvailable())) {
    logger.error('Docker is not installed')
    return false
  }

  if (!(await docker.isDockerRunning())) {
    logger.error('Docker is not running')
    return false
  }

  // Build the image
  const success = await docker.build(targetDir, { tag: GATEWAY_IMAGE })

  if (success) {
    logger.newline()
    logger.success(`Built: ${GATEWAY_IMAGE}`)
    logger.newline()
    logger.info('Run the gateway:')
    logger.dim(`  docker network create ${FAAS_NETWORK} 2>/dev/null || true`)
    logger.dim(
      `  docker run -d --name ${GATEWAY_CONTAINER} --network ${FAAS_NETWORK} -p 8080:8080 -e FAAS_AUTH_TOKEN=your-token ${GATEWAY_IMAGE}`,
    )
  }

  return success
}

export async function gatewayStart(token?: string): Promise<boolean> {
  logger.title('Starting FaaS Gateway')

  // Check Docker
  if (
    !(await docker.isDockerAvailable()) ||
    !(await docker.isDockerRunning())
  ) {
    logger.error('Docker is not available')
    return false
  }

  // Check if image exists
  if (!(await docker.imageExists(GATEWAY_IMAGE))) {
    logger.error(`Gateway image not found: ${GATEWAY_IMAGE}`)
    logger.info('Run "faas gateway build" first')
    return false
  }

  // Create network if needed
  const { exec } = await import('../utils/shell')
  await exec('docker', ['network', 'create', FAAS_NETWORK])

  // Stop existing container if running
  await exec('docker', ['rm', '-f', GATEWAY_CONTAINER])

  // Start the gateway
  const args = [
    'run',
    '-d',
    '--name',
    GATEWAY_CONTAINER,
    '--network',
    FAAS_NETWORK,
    '-p',
    '8080:8080',
    '--label',
    'faas.gateway=true',
    '--restart',
    'unless-stopped',
  ]

  if (token) {
    args.push('-e', `FAAS_AUTH_TOKEN=${token}`)
  }

  args.push(GATEWAY_IMAGE)

  const result = await exec('docker', args)

  if (result.success) {
    logger.success('Gateway started on http://localhost:8080')
    if (!token) {
      logger.warn('No token set - gateway is running in OPEN mode')
    }
    return true
  } else {
    logger.error('Failed to start gateway')
    logger.dim(result.stderr)
    return false
  }
}

export async function gatewayStop(): Promise<boolean> {
  logger.title('Stopping FaaS Gateway')

  const { exec } = await import('../utils/shell')
  const result = await exec('docker', ['rm', '-f', GATEWAY_CONTAINER])

  if (result.success) {
    logger.success('Gateway stopped')
    return true
  } else {
    logger.error('Failed to stop gateway (may not be running)')
    return false
  }
}

export async function gateway(
  subcommand: string,
  options: GatewayOptions & { token?: string } = {},
): Promise<boolean> {
  switch (subcommand) {
    case 'init':
      return gatewayInit(options)
    case 'build':
      return gatewayBuild(options)
    case 'start':
      return gatewayStart(options.token)
    case 'stop':
      return gatewayStop()
    default:
      logger.error(`Unknown gateway command: ${subcommand}`)
      logger.info('Available commands: init, build, start, stop')
      return false
  }
}

export default gateway
