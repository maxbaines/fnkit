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

## Quick Start

```bash
# Create a function
faas node my-api
cd my-api

# Set up CI/CD pipeline
faas deploy setup

# Push to deploy
git add . && git commit -m "init" && git push

# Done — your function is live!
```

## Installation

### From Binary

Download the pre-built binary for your platform from the [releases page](https://github.com/maxbaines/faas/releases).

```bash
# macOS (Apple Silicon)
curl -L https://github.com/maxbaines/faas/releases/latest/download/faas-macos-arm64 -o faas
chmod +x faas && ./faas install

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

---

## Commands

### Create & Develop

```bash
# Create a new function (shorthand)
faas node hello
faas python myfunction
faas go my-api

# Or use the explicit form
faas new <runtime> <name>

# With a git remote
faas node hello --remote git@github.com:user/hello.git

# Initialize an existing directory
faas init
faas init --runtime python

# Run locally
faas dev
faas dev --port 3000 --target myFunction
```

### Container Management — `faas container`

Manage your deployed function containers.

```bash
faas container ls               # List deployed faas containers
faas container ls --all         # Include non-faas containers
faas container logs my-api      # Tail logs (live)
faas container stop my-api      # Stop a container
```

### API Gateway — `faas gateway`

Centralized token authentication and routing for all function containers via nginx, with a built-in Bun-based orchestrator for multi-function pipelines.

```bash
faas gateway init               # Create gateway project files
faas gateway build              # Build the gateway Docker image
faas gateway start --token xyz  # Start with auth token
faas gateway stop               # Stop the gateway
```

**How it works:**

```
Request → Gateway (port 8080) → validates token → proxies to function container
```

```bash
# Call a function through the gateway
curl -H "Authorization: Bearer your-token" http://localhost:8080/my-function

# Path forwarding
curl -H "Authorization: Bearer your-token" http://localhost:8080/my-function/api/users

# Health check (no auth)
curl http://localhost:8080/health
```

#### Orchestrator — `faas gateway orchestrate`

Define multi-function pipelines that call several functions in a single request — either **sequentially** (chaining output → input) or in **parallel** (fan-out, merge results). Pipeline configs are stored in an S3-compatible bucket (MinIO, Garage, AWS S3).

```bash
# Configure S3/MinIO bucket for pipeline storage
faas gateway orchestrate init --s3-bucket faas-pipelines --s3-endpoint http://localhost:9000

# Add a sequential pipeline (each step gets previous output)
faas gateway orchestrate add process-order \
  --steps validate-order,charge-payment,send-email \
  --mode sequential

# Add a parallel pipeline (all steps called simultaneously, results merged)
faas gateway orchestrate add enrich-user \
  --steps get-profile,get-preferences,get-history \
  --mode parallel

# List & manage pipelines
faas gateway orchestrate ls
faas gateway orchestrate remove process-order
```

**Calling pipelines:**

```bash
# Sequential: validate-order → charge-payment → send-email (chained)
curl -H "Authorization: Bearer token" \
  -d '{"orderId": 123}' \
  http://localhost:8080/orchestrate/process-order

# Parallel: all 3 called simultaneously, results merged
curl -H "Authorization: Bearer token" \
  -d '{"userId": 456}' \
  http://localhost:8080/orchestrate/enrich-user
# → { "get-profile": {...}, "get-preferences": {...}, "get-history": {...} }
```

**Pipeline config format** (stored as `<name>.json` in S3):

```json
{
  "mode": "sequential",
  "steps": ["validate-order", "charge-payment", "send-email"]
}
```

**Starting the gateway with S3 credentials:**

```bash
faas gateway start --token secret \
  --s3-bucket faas-pipelines \
  --s3-endpoint http://minio:9000 \
  --s3-access-key minioadmin \
  --s3-secret-key minioadmin
```

**Architecture:**

```
Request → nginx (port 8080)
  ├── /orchestrate/<name>  → Bun orchestrator (port 3000 internal)
  │                           ├── fetches <name>.json from S3
  │                           ├── calls functions sequentially or in parallel
  │                           └── returns combined result
  ├── /health              → 200 OK
  └── /<name>/*            → proxy to container (existing behavior)
```

### Reverse Proxy — `faas proxy`

Automatic HTTPS and domain management via Caddy with Let's Encrypt.

```bash
faas proxy init                 # Create Caddy proxy setup
faas proxy add api.example.com  # Add domain route to gateway
faas proxy ls                   # List configured domains
faas proxy remove api.example.com
```

**Architecture:**

```
Internet → Caddy (443, auto-TLS) → Gateway (8080, auth) → Function containers
```

### Deploy Pipeline — `faas deploy`

Automated git-push-to-deploy via Forgejo (default) or GitHub Actions.

```
Forgejo:  push → runner builds image → deploy container → health check
GitHub:   push → build & push to GHCR → SSH deploy → health check
```

```bash
faas deploy setup               # Interactive setup wizard (recommended)
faas deploy init                # Generate Forgejo workflow
faas deploy init --provider github  # Generate GitHub Actions workflow
faas deploy runner              # Generate Forgejo runner setup files
faas deploy status              # Check pipeline & container status
```

#### Forgejo Runner Setup

The runner executes CI workflows and needs Docker socket access to build/deploy on the host.

```bash
faas deploy runner
# → Creates faas-runner/ with docker-compose.yml, .env.example, and README
```

Then on your server:

1. **Enable Actions** in Forgejo: Site Administration → Actions → Enable
2. **Get a registration token**: Site Administration → Actions → Runners → Create new runner
3. **Configure**: `cp .env.example .env` and fill in your values
4. **Start**: `docker compose up -d`
5. **Verify**: Check Forgejo Admin → Runners — should appear as online

### Docker Images — `faas image`

Build and push Docker images for your functions.

```bash
faas image build                # Build with default tag
faas image build --tag myapp:v1 # Build with custom tag
faas image push --registry ghcr.io  # Build and push to registry
```

### Utilities

```bash
faas doctor                     # Check all runtime dependencies
faas doctor node                # Check specific runtime
faas install                    # Install faas to /usr/local/bin
faas uninstall                  # Remove global installation
```

---

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

---

## Command Reference

Run `faas <command>` with no subcommand to see detailed help for any group.

| Command                                  | Description                       |
| ---------------------------------------- | --------------------------------- |
| **Create & Develop**                     |                                   |
| `faas new <runtime> <name>`              | Create a new function project     |
| `faas <runtime> <name>`                  | Shorthand for `new`               |
| `faas init`                              | Initialize existing directory     |
| `faas dev`                               | Run function locally              |
| **Containers**                           |                                   |
| `faas container ls`                      | List deployed containers          |
| `faas container logs <name>`             | View container logs               |
| `faas container stop <name>`             | Stop a container                  |
| **Gateway**                              |                                   |
| `faas gateway init`                      | Create gateway project            |
| `faas gateway build`                     | Build gateway image               |
| `faas gateway start`                     | Start gateway                     |
| `faas gateway stop`                      | Stop gateway                      |
| `faas gateway orchestrate init`          | Configure S3 bucket for pipelines |
| `faas gateway orchestrate add <name>`    | Add a pipeline to S3              |
| `faas gateway orchestrate ls`            | List defined pipelines            |
| `faas gateway orchestrate remove <name>` | Remove a pipeline                 |
| **Proxy**                                |                                   |
| `faas proxy init`                        | Create Caddy reverse proxy        |
| `faas proxy add <domain>`                | Add domain route                  |
| `faas proxy remove <domain>`             | Remove domain route               |
| `faas proxy ls`                          | List configured domains           |
| **Deploy**                               |                                   |
| `faas deploy setup`                      | Guided deploy pipeline setup      |
| `faas deploy init`                       | Generate deploy workflow          |
| `faas deploy runner`                     | Generate Forgejo runner setup     |
| `faas deploy status`                     | Check deployment status           |
| **Images**                               |                                   |
| `faas image build`                       | Build Docker image                |
| `faas image push`                        | Push to registry                  |
| **Utilities**                            |                                   |
| `faas doctor [runtime]`                  | Check dependencies                |
| `faas install`                           | Install faas globally             |
| `faas uninstall`                         | Remove global installation        |

---

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
faas gateway build
faas gateway start --token your-secret-token
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
│   ├── index.ts              # CLI entry point & help system
│   ├── commands/
│   │   ├── create.ts         # Create function project
│   │   ├── init.ts           # Initialize existing project
│   │   ├── run.ts            # Local dev server
│   │   ├── publish.ts        # Docker build & push
│   │   ├── containers.ts     # Container management
│   │   ├── gateway.ts        # API gateway management
│   │   ├── proxy.ts          # Caddy proxy management
│   │   ├── deploy.ts         # CI/CD pipelines (Forgejo/GitHub)
│   │   ├── doctor.ts         # Runtime dependency checks
│   │   └── global.ts         # Install/uninstall
│   ├── runtimes/
│   │   ├── base.ts           # Runtime interface
│   │   └── *.ts              # Runtime definitions (9 runtimes)
│   └── utils/
│       ├── docker.ts         # Docker operations
│       ├── git.ts            # Git operations
│       ├── logger.ts         # Colored output
│       └── shell.ts          # Command execution
├── dist/
│   └── faas                  # Compiled binary
└── package.json
```

## License

MIT
