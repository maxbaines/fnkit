# FAAS CLI

A command-line tool for scaffolding and deploying serverless functions using the [Google Cloud Functions Framework](https://github.com/GoogleCloudPlatform/functions-framework).

## Features

- 🚀 **Quick scaffolding** - Create new function projects in seconds
- 🐳 **Docker support** - Build deployable containers with one command
- 🔧 **Multi-runtime** - Support for 9 different runtimes
- ✅ **Runtime checks** - Verify your development environment
- 📦 **Single binary** - No dependencies required

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

Download the pre-built binary for your platform from the [releases page](https://github.com/your-repo/faas/releases).

```bash
# macOS (Apple Silicon)
curl -L https://github.com/your-repo/faas/releases/latest/download/faas-macos-arm64 -o faas
chmod +x faas
./faas install  # Installs to /usr/local/bin (requires sudo)

# macOS (Intel)
curl -L https://github.com/your-repo/faas/releases/latest/download/faas-macos-x64 -o faas
chmod +x faas
./faas install

# Linux (x64)
curl -L https://github.com/your-repo/faas/releases/latest/download/faas-linux-x64 -o faas
chmod +x faas
./faas install

# Linux (ARM64)
curl -L https://github.com/your-repo/faas/releases/latest/download/faas-linux-arm64 -o faas
chmod +x faas
./faas install

# Windows (PowerShell as Administrator)
Invoke-WebRequest -Uri https://github.com/your-repo/faas/releases/latest/download/faas-windows-x64.exe -OutFile faas.exe
.\faas.exe install
# Then add C:\Program Files\faas to your PATH
```

### From Source

Requires [Bun](https://bun.sh) to be installed.

```bash
git clone https://github.com/your-repo/faas.git
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

### Manage Containers

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

### Check Runtime Dependencies

```bash
# Check all runtimes
faas doctor

# Check specific runtime
faas doctor node
faas doctor dotnet
```

### API Gateway (Token Authentication)

The FaaS Gateway provides centralized token authentication for all your functions. Deploy it once and route all function calls through it.

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

**Architecture:**

```
Request → Gateway (port 8080) → validates token → Function container
```

**Calling functions through the gateway:**

```bash
# With authentication
curl -H "Authorization: Bearer your-secret-token" \
  http://localhost:8080/my-function-name

# The path after the function name is forwarded
curl -H "Authorization: Bearer your-secret-token" \
  http://localhost:8080/my-function-name/api/users
```

**Deploying to Coolify:**

1. Deploy the `faas-gateway` directory as a Docker service
2. Set the `FAAS_AUTH_TOKEN` environment variable
3. Ensure all function containers are on the same Docker network (`faas-network`)
4. Point your domain at the gateway

### Deploy to Remote Server (Git Push to Deploy)

Deploy your function containers to a remote Linux server by pushing to Git. Supports Forgejo (default) and GitHub.

**Architecture:**

```
git push → Forgejo/GitHub Actions → Build image → Deploy container → faas-network → Gateway
```

#### One-Time: Set Up the Forgejo Runner

The runner executes CI workflows and needs Docker socket access to build/deploy containers on the host.

```bash
# Generate runner setup files
faas deploy runner
# → Creates faas-runner/ with docker-compose.yml and instructions
```

Then on your server:

1. **Enable Actions** in Forgejo: Site Administration → Actions → Enable
2. **Get a registration token**: Site Administration → Actions → Runners → Create new runner
3. **Register the runner**:
   ```bash
   cd faas-runner
   docker compose run --rm forgejo-runner \
     forgejo-runner register \
     --instance https://your-forgejo-url \
     --token YOUR_TOKEN \
     --name faas-runner \
     --labels docker:docker://node:20 \
     --no-interactive
   ```
4. **Start the runner**:
   ```bash
   docker compose up -d
   ```

#### Per Function: Set Up Deploy Workflow

```bash
# Inside your function project
cd my-function

# Forgejo (default)
faas deploy init

# Or GitHub Actions
faas deploy init --provider github
```

This generates a workflow file that builds and deploys on every push to `main`.

**Forgejo** (`.forgejo/workflows/deploy.yml`):

- Builds the Docker image directly on the host via the runner
- No registry needed — the runner has Docker socket access
- Stops the old container and starts the new one on `faas-network`

**GitHub** (`.github/workflows/deploy.yml`):

- Builds and pushes to GitHub Container Registry (ghcr.io)
- SSHs to your server, pulls the image, and deploys
- Requires secrets: `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`

#### Full Example

```bash
# Create a function
faas node my-api
cd my-api

# Set up deployment
faas deploy init

# Push to deploy
git remote add origin http://forgejo.example.com/user/my-api.git
git add . && git commit -m "init" && git push -u origin main

# Function is now live!
curl -H "Authorization: Bearer <token>" http://gateway.example.com/my-api
```

### Initialize Existing Project

```bash
cd existing-project
faas init

# Specify runtime
faas init --runtime python
```

## Commands

| Command                | Description                   |
| ---------------------- | ----------------------------- |
| `new <runtime> <name>` | Create a new function project |
| `init`                 | Initialize existing directory |
| `dev`                  | Run function locally          |
| `container ls`         | List deployed containers      |
| `container logs`       | View container logs           |
| `container stop`       | Stop a container              |
| `gateway init`         | Create gateway project        |
| `gateway build`        | Build gateway image           |
| `gateway start`        | Start gateway                 |
| `gateway stop`         | Stop gateway                  |
| `deploy init`          | Generate deploy workflow      |
| `deploy runner`        | Generate Forgejo runner setup |
| `image build`          | Build Docker image            |
| `image push`           | Push to registry              |
| `doctor [runtime]`     | Check dependencies            |
| `install`              | Install faas globally         |
| `uninstall`            | Remove global installation    |

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
│   │   ├── deploy.ts         # Deploy workflows (Forgejo/GitHub)
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

## License

MIT
