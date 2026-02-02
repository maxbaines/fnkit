# FAAS CLI

A command-line tool for scaffolding and deploying serverless functions using the [Google Cloud Functions Framework](https://github.com/GoogleCloudPlatform/functions-framework).

## Features

- 🚀 **Quick scaffolding** - Create new function projects in seconds
- 🐳 **Docker support** - Build deployable containers with one command
- 🔧 **Multi-runtime** - Support for 9 different runtimes
- ✅ **Runtime checks** - Verify your development environment
- 📦 **Single binary** - No dependencies required

## Supported Runtimes

| Runtime | Aliases                  | Framework                                                                                       |
| ------- | ------------------------ | ----------------------------------------------------------------------------------------------- |
| Node.js | `nodejs`, `node`, `js`   | [functions-framework-nodejs](https://github.com/GoogleCloudPlatform/functions-framework-nodejs) |
| Python  | `python`, `py`           | [functions-framework-python](https://github.com/GoogleCloudPlatform/functions-framework-python) |
| Go      | `go`, `golang`           | [functions-framework-go](https://github.com/GoogleCloudPlatform/functions-framework-go)         |
| Java    | `java`                   | [functions-framework-java](https://github.com/GoogleCloudPlatform/functions-framework-java)     |
| Ruby    | `ruby`, `rb`             | [functions-framework-ruby](https://github.com/GoogleCloudPlatform/functions-framework-ruby)     |
| .NET    | `dotnet`, `csharp`, `cs` | [functions-framework-dotnet](https://github.com/GoogleCloudPlatform/functions-framework-dotnet) |
| PHP     | `php`                    | [functions-framework-php](https://github.com/GoogleCloudPlatform/functions-framework-php)       |
| Dart    | `dart`                   | [functions-framework-dart](https://github.com/GoogleCloudPlatform/functions-framework-dart)     |
| C++     | `cpp`, `c++`             | [functions-framework-cpp](https://github.com/GoogleCloudPlatform/functions-framework-cpp)       |

## Installation

### From Binary

Download the pre-built binary for your platform from the [releases page](https://github.com/your-repo/faas/releases).

```bash
# macOS (Apple Silicon)
curl -L https://github.com/your-repo/faas/releases/latest/download/faas-macos-arm64 -o faas
chmod +x faas
sudo mv faas /usr/local/bin/
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
faas nodejs hello
faas dotnet my-api
faas python myfunction

# Using explicit create command
faas create nodejs hello
faas c python myfunction

# With git remote
faas nodejs hello --remote git@github.com:user/hello.git
```

### Run Locally

```bash
cd my-function
faas run

# With options
faas run --target myFunction --port 3000
```

### Build Docker Container

```bash
cd my-function
faas publish

# With custom tag
faas publish --tag myapp:v1

# Push to registry
faas publish --tag myapp:v1 --registry gcr.io/myproject --push
```

### Check Runtime Dependencies

```bash
# Check all runtimes
faas doctor

# Check specific runtime
faas doctor nodejs
faas doctor dotnet
```

### Initialize Existing Project

```bash
cd existing-project
faas init

# Specify runtime
faas init --runtime python
```

## Commands

| Command                   | Alias | Description                             |
| ------------------------- | ----- | --------------------------------------- |
| `create <runtime> <name>` | `c`   | Create a new function project           |
| `init`                    |       | Initialize existing project as function |
| `run`                     | `dev` | Run function locally                    |
| `publish`                 | `p`   | Build Docker container                  |
| `doctor [runtime]`        |       | Check runtime dependencies              |
| `help`                    |       | Show help message                       |
| `version`                 |       | Show version                            |

## Options

| Option                  | Short | Description                  |
| ----------------------- | ----- | ---------------------------- |
| `--remote <url>`        | `-r`  | Set git remote for create    |
| `--tag <tag>`           | `-t`  | Docker image tag for publish |
| `--registry <registry>` |       | Docker registry for publish  |
| `--push`                |       | Push image after build       |
| `--target <function>`   |       | Function target for run      |
| `--port <port>`         |       | Port for run                 |
| `--runtime <runtime>`   |       | Runtime for init             |

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
