---
layout: default
title: Commands
nav_order: 5
---

# Command Reference

Complete reference for all fnkit CLI commands, flags, and options.

Run `fnkit help` or `fnkit <command>` with no subcommand to see built-in help.

## Create & Develop

### `fnkit new <runtime> <name>`

Create a new function project.

```bash
fnkit new node my-api
fnkit new python my-api --remote git@github.com:user/my-api.git
```

| Option | Description |
|:-------|:------------|
| `--remote`, `-r` | Git remote URL to add as `origin` |

### `fnkit <runtime> <name>`

Shorthand for `fnkit new`. All runtimes work as direct commands:

```bash
fnkit node my-api
fnkit python my-api
fnkit go my-api
fnkit java my-api
fnkit ruby my-api
fnkit dotnet my-api
fnkit php my-api
fnkit dart my-api
fnkit cpp my-api
fnkit node-mqtt my-handler
fnkit go-mqtt my-handler
fnkit dotnet-mqtt my-handler
```

### `fnkit init`

Initialize an existing directory as a function project. Detects the runtime from existing files.

```bash
fnkit init
fnkit init --runtime python
```

| Option | Description |
|:-------|:------------|
| `--runtime` | Specify runtime explicitly instead of auto-detecting |

### `fnkit dev`

Run the function locally using the runtime's development server.

```bash
fnkit dev
fnkit dev --port 3000
fnkit dev --target myFunction
```

| Option | Description |
|:-------|:------------|
| `--port`, `-p` | Port to listen on (default: 8080) |
| `--target` | Function target name |

## Containers

### `fnkit container ls`

List deployed fnkit function containers.

```bash
fnkit container ls
fnkit container ls --all
```

| Option | Description |
|:-------|:------------|
| `--all` | Show all Docker containers, not just fnkit-labelled ones |

### `fnkit container logs <name>`

Tail live logs from a running container.

```bash
fnkit container logs my-api
```

### `fnkit container stop <name>`

Stop a running container.

```bash
fnkit container stop my-api
```

## Gateway

Manage the API gateway. See [Gateway docs]({% link docs/gateway.md %}) for architecture and detailed usage.

### `fnkit gateway init`

Create the gateway project files (`fnkit-gateway/` directory).

```bash
fnkit gateway init
fnkit gateway init --output custom-dir
```

| Option | Description |
|:-------|:------------|
| `--output` | Output directory (default: `fnkit-gateway`) |

### `fnkit gateway build`

Build the gateway Docker image.

```bash
fnkit gateway build
```

### `fnkit gateway start`

Start the gateway container.

```bash
fnkit gateway start --token your-secret
fnkit gateway start --token secret --s3-bucket pipelines --s3-endpoint http://minio:9000
```

| Option | Description |
|:-------|:------------|
| `--token` | Bearer token for authentication. Omit for open mode (no auth) |
| `--s3-bucket` | S3/MinIO bucket for orchestrator pipeline configs |
| `--s3-endpoint` | S3-compatible endpoint URL |
| `--s3-region` | S3 region (default: `us-east-1`) |
| `--s3-access-key` | S3 access key |
| `--s3-secret-key` | S3 secret key |

### `fnkit gateway stop`

Stop the gateway container.

```bash
fnkit gateway stop
```

### `fnkit gateway orchestrate init`

Configure the S3 bucket for storing pipeline definitions.

```bash
fnkit gateway orchestrate init --s3-bucket fnkit-pipelines --s3-endpoint http://minio:9000
```

| Option | Description |
|:-------|:------------|
| `--s3-bucket` | S3/MinIO bucket name (required) |
| `--s3-endpoint` | S3-compatible endpoint URL |
| `--s3-region` | S3 region (default: `us-east-1`) |

### `fnkit gateway orchestrate add <name>`

Add a multi-function pipeline.

```bash
fnkit gateway orchestrate add process-order --steps validate,charge,notify --mode sequential
fnkit gateway orchestrate add enrich-user --steps profile,prefs,history --mode parallel
```

| Option | Description |
|:-------|:------------|
| `--steps` | Comma-separated list of function names (required) |
| `--mode` | `sequential` or `parallel` (required) |
| `--s3-access-key` | S3 access key for upload |
| `--s3-secret-key` | S3 secret key for upload |

### `fnkit gateway orchestrate ls`

List all defined pipelines in the S3 bucket.

```bash
fnkit gateway orchestrate ls
```

### `fnkit gateway orchestrate remove <name>`

Remove a pipeline from the S3 bucket.

```bash
fnkit gateway orchestrate remove process-order
```

## Cache

Manage the shared Valkey cache. See [Cache docs]({% link docs/cache.md %}) for language-specific examples.

### `fnkit cache init`

Create cache project files (`fnkit-cache/` directory).

```bash
fnkit cache init
fnkit cache init --output custom-dir
```

| Option | Description |
|:-------|:------------|
| `--output` | Output directory (default: `fnkit-cache`) |

### `fnkit cache start`

Start the Valkey cache container on `fnkit-network`.

```bash
fnkit cache start
fnkit cache start --maxmemory 512mb
```

| Option | Description |
|:-------|:------------|
| `--maxmemory` | Maximum memory allocation (default: `256mb`) |

### `fnkit cache stop`

Stop the cache container. Data persists in the Docker volume.

```bash
fnkit cache stop
```

## Proxy

Manage the Caddy reverse proxy. See [Proxy docs]({% link docs/proxy.md %}) for details.

### `fnkit proxy init`

Create the Caddy proxy project files (`fnkit-proxy/` directory).

```bash
fnkit proxy init
fnkit proxy init --output custom-dir
```

| Option | Description |
|:-------|:------------|
| `--output` | Output directory (default: `fnkit-proxy`) |

### `fnkit proxy add <domain>`

Add a domain route to the Caddyfile, pointing to the gateway.

```bash
fnkit proxy add api.example.com
```

### `fnkit proxy remove <domain>`

Remove a domain route from the Caddyfile.

```bash
fnkit proxy remove api.example.com
```

### `fnkit proxy ls`

List all configured domain routes.

```bash
fnkit proxy ls
```

## Deploy

Manage CI/CD deploy pipelines. See [Deploy docs]({% link docs/deploy.md %}) for full details.

### `fnkit deploy setup`

Interactive setup wizard. Checks prerequisites, generates the deploy workflow, and prints a checklist.

```bash
fnkit deploy setup
fnkit deploy setup --provider github
```

| Option | Description |
|:-------|:------------|
| `--provider` | `forgejo` (default) or `github` |

### `fnkit deploy init`

Generate a deploy workflow file without the interactive wizard.

```bash
fnkit deploy init
fnkit deploy init --provider github
```

| Option | Description |
|:-------|:------------|
| `--provider` | `forgejo` (default) or `github` |

### `fnkit deploy runner`

Generate Forgejo Actions runner setup files (`fnkit-runner/` directory).

```bash
fnkit deploy runner
fnkit deploy runner --output custom-dir
```

| Option | Description |
|:-------|:------------|
| `--output` | Output directory (default: `fnkit-runner`) |

### `fnkit deploy status`

Check the deployment status — pipeline config, git status, and container health.

```bash
fnkit deploy status
```

## Images

### `fnkit image build`

Build a Docker image for the current function project.

```bash
fnkit image build
fnkit image build --tag myapp:v1
```

| Option | Description |
|:-------|:------------|
| `--tag`, `-t` | Docker image tag (default: `fnkit-fn-<project>:latest`) |
| `--target` | Function target name |

### `fnkit image push`

Build and push a Docker image to a registry.

```bash
fnkit image push --registry ghcr.io
fnkit image push --registry ghcr.io --tag myapp:v1
```

| Option | Description |
|:-------|:------------|
| `--tag`, `-t` | Docker image tag |
| `--registry` | Docker registry URL (required for push) |
| `--target` | Function target name |

## Utilities

### `fnkit doctor [runtime]`

Check that runtime dependencies are installed and available.

```bash
fnkit doctor          # Check all runtimes
fnkit doctor node     # Check Node.js
fnkit doctor java     # Check Java + Maven
```

### `fnkit install`

Install the fnkit binary to `/usr/local/bin` for global access.

```bash
fnkit install
```

### `fnkit uninstall`

Remove the fnkit binary from `/usr/local/bin`.

```bash
fnkit uninstall
```

### `fnkit --version`

Print the current version.

```bash
fnkit --version
fnkit -v
```

### `fnkit help`

Show the help screen.

```bash
fnkit help
fnkit --help
fnkit -h
```
