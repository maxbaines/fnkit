# FNKIT CLI

A command-line tool for scaffolding and deploying serverless functions using the [Google Cloud Functions Framework](https://github.com/GoogleCloudPlatform/functions-framework). Git push to deploy — no external platforms required.

## Architecture

```
Internet → Caddy (TLS/domains) → fnkit-gateway (auth/routing) → Function containers
                                                                    ↑
                                                    Forgejo/GitHub Actions
                                                    (git push → docker build → deploy)
```

**Dependencies:** Docker + Git. That's it.

## Quick Start

```bash
# Create a function
fnkit node my-api
cd my-api

# Set up CI/CD pipeline
fnkit deploy setup

# Push to deploy
git add . && git commit -m "init" && git push

# Done — your function is live!
```

## Installation

### From Binary

Download the pre-built binary for your platform from the [releases page](https://github.com/maxbaines/fnkit/releases).

```bash
# macOS (Apple Silicon)
curl -L https://github.com/maxbaines/fnkit/releases/latest/download/fnkit-macos-arm64 -o fnkit
chmod +x fnkit && ./fnkit install

# macOS (Intel)
curl -L https://github.com/maxbaines/fnkit/releases/latest/download/fnkit-macos-x64 -o fnkit
chmod +x fnkit && ./fnkit install

# Linux (x64)
curl -L https://github.com/maxbaines/fnkit/releases/latest/download/fnkit-linux-x64 -o fnkit
chmod +x fnkit && ./fnkit install

# Linux (ARM64)
curl -L https://github.com/maxbaines/fnkit/releases/latest/download/fnkit-linux-arm64 -o fnkit
chmod +x fnkit && ./fnkit install

# Windows (PowerShell as Administrator)
Invoke-WebRequest -Uri https://github.com/maxbaines/fnkit/releases/latest/download/fnkit-windows-x64.exe -OutFile fnkit.exe
.\fnkit.exe install
```

### From Source

Requires [Bun](https://bun.sh) to be installed.

```bash
git clone https://github.com/maxbaines/fnkit.git
cd fnkit
bun install
bun run build
# Binary is now at ./dist/fnkit
```

---

## Commands

### Create & Develop

```bash
# Create a new function (shorthand)
fnkit node hello
fnkit python myfunction
fnkit go my-api

# Or use the explicit form
fnkit new <runtime> <name>

# With a git remote
fnkit node hello --remote git@github.com:user/hello.git

# Initialize an existing directory
fnkit init
fnkit init --runtime python

# Run locally
fnkit dev
fnkit dev --port 3000 --target myFunction
```

### Container Management — `fnkit container`

Manage your deployed function containers.

```bash
fnkit container ls               # List deployed fnkit containers
fnkit container ls --all         # Include non-fnkit containers
fnkit container logs my-api      # Tail logs (live)
fnkit container stop my-api      # Stop a container
```

### API Gateway — `fnkit gateway`

Centralized token authentication and routing for all function containers via nginx, with a built-in Bun-based orchestrator for multi-function pipelines.

```bash
fnkit gateway init               # Create gateway project files
fnkit gateway build              # Build the gateway Docker image
fnkit gateway start --token xyz  # Start with auth token
fnkit gateway stop               # Stop the gateway
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

#### Orchestrator — `fnkit gateway orchestrate`

Define multi-function pipelines that call several functions in a single request — either **sequentially** (chaining output → input) or in **parallel** (fan-out, merge results). Pipeline configs are stored in an S3-compatible bucket (MinIO, Garage, AWS S3).

```bash
# Configure S3/MinIO bucket for pipeline storage
fnkit gateway orchestrate init --s3-bucket fnkit-pipelines --s3-endpoint http://localhost:9000

# Add a sequential pipeline (each step gets previous output)
fnkit gateway orchestrate add process-order \
  --steps validate-order,charge-payment,send-email \
  --mode sequential

# Add a parallel pipeline (all steps called simultaneously, results merged)
fnkit gateway orchestrate add enrich-user \
  --steps get-profile,get-preferences,get-history \
  --mode parallel

# List & manage pipelines
fnkit gateway orchestrate ls
fnkit gateway orchestrate remove process-order
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
fnkit gateway start --token secret \
  --s3-bucket fnkit-pipelines \
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

### Reverse Proxy — `fnkit proxy`

Automatic HTTPS and domain management via Caddy with Let's Encrypt.

```bash
fnkit proxy init                 # Create Caddy proxy setup
fnkit proxy add api.example.com  # Add domain route to gateway
fnkit proxy ls                   # List configured domains
fnkit proxy remove api.example.com
```

**Architecture:**

```
Internet → Caddy (443, auto-TLS) → Gateway (8080, auth) → Function containers
```

### Deploy Pipeline — `fnkit deploy`

Automated git-push-to-deploy via Forgejo (default) or GitHub Actions.

```
Forgejo:  push → runner builds image → deploy container → health check
GitHub:   push → build & push to GHCR → SSH deploy → health check
```

```bash
fnkit deploy setup               # Interactive setup wizard (recommended)
fnkit deploy init                # Generate Forgejo workflow
fnkit deploy init --provider github  # Generate GitHub Actions workflow
fnkit deploy runner              # Generate Forgejo runner setup files
fnkit deploy status              # Check pipeline & container status
```

#### Forgejo Runner Setup

The runner executes CI workflows and needs Docker socket access to build/deploy on the host.

```bash
fnkit deploy runner
# → Creates fnkit-runner/ with docker-compose.yml, .env.example, and README
```

Then on your server:

1. **Enable Actions** in Forgejo: Site Administration → Actions → Enable
2. **Get a registration token**: Site Administration → Actions → Runners → Create new runner
3. **Configure**: `cp .env.example .env` and fill in your values
4. **Start**: `docker compose up -d`
5. **Verify**: Check Forgejo Admin → Runners — should appear as online

### Docker Images — `fnkit image`

Build and push Docker images for your functions.

```bash
fnkit image build                # Build with default tag
fnkit image build --tag myapp:v1 # Build with custom tag
fnkit image push --registry ghcr.io  # Build and push to registry
```

### Utilities

```bash
fnkit doctor                     # Check all runtime dependencies
fnkit doctor node                # Check specific runtime
fnkit install                    # Install fnkit to /usr/local/bin
fnkit uninstall                  # Remove global installation
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

Run `fnkit <command>` with no subcommand to see detailed help for any group.

| Command                                   | Description                       |
| ----------------------------------------- | --------------------------------- |
| **Create & Develop**                      |                                   |
| `fnkit new <runtime> <name>`              | Create a new function project     |
| `fnkit <runtime> <name>`                  | Shorthand for `new`               |
| `fnkit init`                              | Initialize existing directory     |
| `fnkit dev`                               | Run function locally              |
| **Containers**                            |                                   |
| `fnkit container ls`                      | List deployed containers          |
| `fnkit container logs <name>`             | View container logs               |
| `fnkit container stop <name>`             | Stop a container                  |
| **Gateway**                               |                                   |
| `fnkit gateway init`                      | Create gateway project            |
| `fnkit gateway build`                     | Build gateway image               |
| `fnkit gateway start`                     | Start gateway                     |
| `fnkit gateway stop`                      | Stop gateway                      |
| `fnkit gateway orchestrate init`          | Configure S3 bucket for pipelines |
| `fnkit gateway orchestrate add <name>`    | Add a pipeline to S3              |
| `fnkit gateway orchestrate ls`            | List defined pipelines            |
| `fnkit gateway orchestrate remove <name>` | Remove a pipeline                 |
| **Proxy**                                 |                                   |
| `fnkit proxy init`                        | Create Caddy reverse proxy        |
| `fnkit proxy add <domain>`                | Add domain route                  |
| `fnkit proxy remove <domain>`             | Remove domain route               |
| `fnkit proxy ls`                          | List configured domains           |
| **Deploy**                                |                                   |
| `fnkit deploy setup`                      | Guided deploy pipeline setup      |
| `fnkit deploy init`                       | Generate deploy workflow          |
| `fnkit deploy runner`                     | Generate Forgejo runner setup     |
| `fnkit deploy status`                     | Check deployment status           |
| **Images**                                |                                   |
| `fnkit image build`                       | Build Docker image                |
| `fnkit image push`                        | Push to registry                  |
| **Utilities**                             |                                   |
| `fnkit doctor [runtime]`                  | Check dependencies                |
| `fnkit install`                           | Install fnkit globally            |
| `fnkit uninstall`                         | Remove global installation        |

---

## Server Setup Checklist

Setting up a fresh server to run FnKit:

```bash
# 1. Install Docker
curl -fsSL https://get.docker.com | sh

# 2. Create the Docker network
docker network create fnkit-network

# 3. Set up the gateway
fnkit gateway init
cd fnkit-gateway
fnkit gateway build
fnkit gateway start --token your-secret-token
cd ..

# 4. Set up the reverse proxy (for HTTPS/domains)
fnkit proxy init
fnkit proxy add api.example.com
cd fnkit-proxy
docker compose up -d
cd ..

# 5. Set up the Forgejo runner (for CI/CD)
fnkit deploy runner
cd fnkit-runner
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
fnkit/
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
│   └── fnkit                 # Compiled binary
└── package.json
```

## License

MIT
