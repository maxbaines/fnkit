# FAAS CLI

A command-line tool for scaffolding and deploying serverless functions using the [Google Cloud Functions Framework](https://github.com/GoogleCloudPlatform/functions-framework). Git push to deploy — no external platforms required.

## Architecture

```
Internet → Caddy (TLS/domains) → faas-gateway (auth/routing) → Function containers
                                                                    ↑
                                                    Forgejo/GitHub Actions
                                                    (git push → docker build → deploy)
```

**Dependencies:** Docker + Git. That's it.

## Features

- 🚀 **Quick scaffolding** — Create new function projects in seconds
- 🐳 **Docker native** — Build deployable containers with `docker build`
- 🔧 **Multi-runtime** — Support for 9 different runtimes
- 🔄 **Git push to deploy** — Automated CI/CD via Forgejo (default) or GitHub Actions
- 🔒 **Automatic HTTPS** — Caddy reverse proxy with Let's Encrypt
- 🌐 **API Gateway** — Token auth and container routing via nginx
- ✅ **Health checks & rollback** — Deploy pipeline with automatic rollback on failure
- 📦 **Single binary** — No dependencies required

## Quick Start

```bash
# Create a function
faas node my-api
cd my-api

# Run locally
faas dev

# Set up CI/CD pipeline (Forgejo by default)
faas deploy setup

# Push to deploy
git add . && git commit -m "init" && git push

# Done — your function is live!
```

## Supported Runtimes

| Runtime | Command  | Framework                                                                                       |
| ------- | -------- | ----------------------------------------------------------------------------------------------- |
| Node.js | `node`   | [functions-framework-nodejs](https://github.com/GoogleCloudPlatform/functions-framework-nodejs) |
| Python  | `python` | [functions-framework-python](https://github.com/GoogleCloudPlatform/functions-framework-python) |
| Go      | `go`     | [functions-framework-go](https://github.com/GoogleCloudPlatform/functions-framework-go)         |
| Java    | `java`   | [functions-framework-java](https://github.com/GoogleCloudPlatform/functions-framework-java)     |
| Ruby    | `ruby`   | [functions-framework-ruby](https://github.com/GoogleCloudPlatform/functions-framework-ruby)     |
| .NET    | `dotnet` | [functions-framework-dotnet](https://github.com/GoogleCloudPlatform/functions-framework-dotnet) |
| PHP     | `php`    | [functions-framework-php](https://github.com/GoogleCloudPlatform/functions-framework-php)       |
| Dart    | `dart`   | [functions-framework-dart](https://github.com/GoogleCloudPlatform/functions-framework-dart)     |
| C++     | `cpp`    | [functions-framework-cpp](https://github.com/GoogleCloudPlatform/functions-framework-cpp)       |

## Installation

### From Binary

Download the pre-built binary for your platform from the [releases page](https://github.com/maxbaines/faas/releases).

```bash
# macOS (Apple Silicon)
curl -L https://github.com/maxbaines/faas/releases/latest/download/faas-macos-arm64 -o faas
chmod +x faas
./faas install  # Installs to /usr/local/bin (requires sudo)

# macOS (Intel)
curl -L https://github.com/maxbaines/faas/releases/latest/download/faas-macos-x64 -o faas
chmod +x faas && ./faas install

# Linux (x64)
curl -L https://github.com/maxbaines/faas/releases/latest/download/faas-linux-x64 -o faas
chmod +x faas && ./faas install

# Linux (ARM64)
curl -L https://github.com/maxbaines/faas/releases/latest/download/faas-linux-arm64 -o faas
chmod +x faas && ./faas install

# Windows (PowerShell as Administrator)
Invoke-WebRequest -Uri https://github.com/maxbaines/faas/releases/latest/download/faas-windows-x64.exe -OutFile faas.exe
.\faas.exe install
```

### From Source

Requires [Bun](https://bun.sh) to be installed.

```bash
git clone https://github.com/maxbaines/faas.git
cd faas
bun install
bun run build
# Binary is now at ./dist/faas
```

## Usage

### Create a New Function

```bash
# Using shorthand (runtime as command)
faas node hello
faas python myfunction
faas dotnet my-api

# Using explicit new command
faas new node hello
faas new python myfunction

# With git remote
faas node hello --remote git@github.com:user/hello.git
```

### Run Locally

```bash
cd my-function
faas dev

# With options
faas dev --target myFunction --port 3000
```

### Build Docker Image

```bash
cd my-function
faas image build

# With custom tag
faas image build --tag myapp:v1

# Build and push to registry
faas image push --tag myapp:v1 --registry gcr.io/myproject
```

### Check Runtime Dependencies

```bash
# Check all runtimes
faas doctor

# Check specific runtime
faas doctor node
faas doctor dotnet
```

---

## Deploy Pipeline (Git Push to Prod)

The core of FaaS is an automated deploy pipeline. Push to git, and your function is live.

```
git push → CI builds Docker image → deploys container → health check → live
```

### Forgejo (Default)

Forgejo Actions runs directly on the host via a runner with Docker socket access. No registry needed — images are built and deployed on the same machine.

```
git push → Forgejo runner → docker build → docker run → faas-network → gateway
```

### GitHub Actions

GitHub Actions builds the image, pushes to GitHub Container Registry (GHCR), then SSHs to your server to pull and deploy.

```
git push → GitHub Actions → build & push to GHCR → SSH → docker pull → docker run → gateway
```

### Set Up the Pipeline

```bash
# Inside your function project
cd my-function

# Guided setup (checks prerequisites, creates workflow)
faas deploy setup

# Or just generate the workflow file
faas deploy init                      # Forgejo (default)
faas deploy init --provider github    # GitHub Actions
```

### Check Deploy Status

```bash
faas deploy status
```

Shows: pipeline type, git remote, uncommitted changes, last commit, and container status.

### One-Time: Set Up the Forgejo Runner

The runner executes CI workflows and needs Docker socket access to build/deploy containers on the host.

```bash
# Generate runner setup files
faas deploy runner
# → Creates faas-runner/ with docker-compose.yml, .env.example, and README
```

Then on your server:

1. **Enable Actions** in Forgejo: Site Administration → Actions → Enable
2. **Get a registration token**: Site Administration → Actions → Runners → Create new runner
3. **Configure**: `cp .env.example .env` and fill in your values
4. **Start**: `docker compose up -d`
5. **Verify**: Check Forgejo Admin → Runners — should appear as online

### Full Example

```bash
# Create a function
faas node my-api
cd my-api

# Set up deployment
faas deploy setup

# Add remote and push
git remote add origin http://forgejo.example.com/user/my-api.git
git add . && git commit -m "init" && git push -u origin main

# ✅ Function is now live!
# The pipeline: built image → deployed container → health checked → running
curl -H "Authorization: Bearer <token>" http://gateway.example.com/my-api
```

---

## API Gateway

The FaaS Gateway provides centralized token authentication and routing for all your functions.

```bash
# Create the gateway project
faas gateway init

# Build the gateway Docker image
faas gateway build

# Start the gateway locally
faas gateway start --token your-secret-token

# Stop the gateway
faas gateway stop
```

**How it works:**

```
Request → Gateway (port 8080) → validates token → proxies to function container
```

**Calling functions through the gateway:**

```bash
# With authentication
curl -H "Authorization: Bearer your-secret-token" \
  http://localhost:8080/my-function-name

# The path after the function name is forwarded
curl -H "Authorization: Bearer your-secret-token" \
  http://localhost:8080/my-function-name/api/users

# Health check (no auth)
curl http://localhost:8080/health
```

---

## Reverse Proxy (HTTPS & Domains)

The FaaS Proxy sets up Caddy for automatic HTTPS and domain management. This replaces the need for any external platform to manage domains and TLS certificates.

```bash
# Create the proxy setup
faas proxy init

# Add a domain route
faas proxy add api.example.com

# List configured domains
faas proxy ls

# Remove a domain
faas proxy remove api.example.com
```

**Architecture:**

```
Internet → Caddy (443, auto-TLS) → Gateway (8080, auth) → Function containers
```

**Setup on your server:**

```bash
# 1. Create and start the proxy
faas proxy init
cd faas-proxy

# 2. Add your domain
faas proxy add api.example.com

# 3. Start Caddy
docker compose up -d

# 4. Point DNS A record to your server IP
# Caddy auto-provisions TLS certificates via Let's Encrypt
```

---

## Container Management

```bash
# List deployed faas containers
faas container ls

# Show all containers (not just faas)
faas container ls --all

# View container logs
faas container logs my-function

# Stop a container
faas container stop my-function
```

### Initialize Existing Project

```bash
cd existing-project
faas init

# Specify runtime
faas init --runtime python
```

## Commands

| Command                 | Description                   |
| ----------------------- | ----------------------------- |
| `new <runtime> <name>`  | Create a new function project |
| `init`                  | Initialize existing directory |
| `dev`                   | Run function locally          |
| `container ls`          | List deployed containers      |
| `container logs`        | View container logs           |
| `container stop`        | Stop a container              |
| `gateway init`          | Create gateway project        |
| `gateway build`         | Build gateway image           |
| `gateway start`         | Start gateway                 |
| `gateway stop`          | Stop gateway                  |
| `proxy init`            | Create Caddy reverse proxy    |
| `proxy add <domain>`    | Add domain route              |
| `proxy remove <domain>` | Remove domain route           |
| `proxy ls`              | List configured domains       |
| `deploy setup`          | Guided deploy pipeline setup  |
| `deploy init`           | Generate deploy workflow      |
| `deploy runner`         | Generate Forgejo runner setup |
| `deploy status`         | Check deployment status       |
| `image build`           | Build Docker image            |
| `image push`            | Push to registry              |
| `doctor [runtime]`      | Check dependencies            |
| `install`               | Install faas globally         |
| `uninstall`             | Remove global installation    |

## Options

| Option                  | Short | Description                       |
| ----------------------- | ----- | --------------------------------- |
| `--remote <url>`        | `-r`  | Git remote for new/init           |
| `--tag <tag>`           | `-t`  | Docker image tag                  |
| `--registry <registry>` |       | Docker registry                   |
| `--push`                |       | Push after build                  |
| `--target <function>`   |       | Function target                   |
| `--port <port>`         | `-p`  | Port for dev server               |
| `--runtime <runtime>`   |       | Runtime for init                  |
| `--token <token>`       |       | Auth token for gateway            |
| `--provider <provider>` |       | Deploy provider (forgejo\|github) |
| `--all`                 |       | Show all containers               |

## Development

```bash
# Run in development mode
bun run dev help
bun run dev doctor

# Build binary
bun run build

# Build for all platforms
bun run build:all

# Type check
bun run typecheck
```

## Project Structure

```
faas/
├── src/
│   ├── index.ts              # CLI entry point
│   ├── commands/
│   │   ├── create.ts         # Create function project
│   │   ├── init.ts           # Initialize existing project
│   │   ├── run.ts            # Local dev server
│   │   ├── publish.ts        # Docker build
│   │   ├── containers.ts     # Container management
│   │   ├── gateway.ts        # Gateway management
│   │   ├── proxy.ts          # Caddy proxy management
│   │   ├── deploy.ts         # Deploy pipelines (Forgejo/GitHub)
│   │   └── doctor.ts         # Runtime checks
│   ├── runtimes/
│   │   ├── base.ts           # Runtime interface
│   │   └── index.ts          # Runtime definitions
│   └── utils/
│       ├── docker.ts         # Docker operations
│       ├── git.ts            # Git operations
│       ├── logger.ts         # Colored output
│       └── shell.ts          # Command execution
├── dist/
│   └── faas                  # Compiled binary
└── package.json
```

## Server Setup Checklist

Setting up a fresh server to run FaaS:

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Create the Docker network
docker network create faas-network

# 3. Set up the gateway
faas gateway init
cd faas-gateway
docker build -t faas-gateway .
docker run -d --name faas-gateway --network faas-network \
  -p 8080:8080 -e FAAS_AUTH_TOKEN=your-secret \
  --restart unless-stopped faas-gateway
cd ..

# 4. Set up the reverse proxy (for HTTPS/domains)
faas proxy init
faas proxy add api.example.com
cd faas-proxy
docker compose up -d
cd ..

# 5. Set up the Forgejo runner (for CI/CD)
faas deploy runner
cd faas-runner
cp .env.example .env
# Edit .env with your Forgejo URL and runner token
docker compose up -d
cd ..

# ✅ Server is ready!
# Now create functions, push to git, and they deploy automatically.
```

## License

MIT
