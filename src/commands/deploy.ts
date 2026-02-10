// Deploy command - generate CI/CD workflows for git-push-to-deploy

import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, resolve, basename } from 'path'
import logger from '../utils/logger'

// ─────────────────────────────────────────────────────────────────
// Forgejo Runner setup
// ─────────────────────────────────────────────────────────────────

const RUNNER_DIR = 'faas-runner'

const RUNNER_DOCKER_COMPOSE = `# Forgejo Actions Runner for FaaS deployments
# Requires Docker socket access to build and deploy function containers

services:
  forgejo-runner:
    image: code.forgejo.org/forgejo/runner:6
    container_name: forgejo-runner
    restart: unless-stopped
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - runner-data:/data
    environment:
      - DOCKER_HOST=unix:///var/run/docker.sock

volumes:
  runner-data:
`

const RUNNER_README = `# FaaS Forgejo Runner

Forgejo Actions runner for deploying FaaS function containers.

## Setup

### 1. Enable Actions in Forgejo

Go to **Site Administration → Actions** and enable Actions.

Or add this environment variable to your Forgejo service:

\`\`\`
FORGEJO__actions__ENABLED=true
\`\`\`

### 2. Get a Runner Registration Token

Go to **Site Administration → Actions → Runners → Create new runner** and copy the token.

### 3. Register the Runner

\`\`\`bash
docker compose run --rm forgejo-runner \\
  forgejo-runner register \\
  --instance https://your-forgejo-url \\
  --token YOUR_TOKEN \\
  --name faas-runner \\
  --labels docker:docker://node:20 \\
  --no-interactive
\`\`\`

### 4. Start the Runner

\`\`\`bash
docker compose up -d
\`\`\`

### 5. Verify

Check **Site Administration → Actions → Runners** — the runner should appear as online.

## Notes

- The runner mounts the host Docker socket, so it can build images and manage containers directly
- Function containers are deployed to the \`faas-network\` Docker network
- The runner label \`docker\` is used in workflow files (\`runs-on: docker\`)
`

// ─────────────────────────────────────────────────────────────────
// Forgejo Actions workflow
// ─────────────────────────────────────────────────────────────────

function generateForgejoWorkflow(functionName: string): string {
  return `# FaaS Deploy — Forgejo Actions
# Builds and deploys this function container on push to main
# Requires: Forgejo runner with Docker socket access

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: docker
    steps:
      - uses: actions/checkout@v4

      - name: Deploy function
        run: |
          FUNCTION_NAME="${functionName}"
          IMAGE_NAME="faas-fn-\${FUNCTION_NAME}:latest"

          echo "🔨 Building \${FUNCTION_NAME}..."
          docker build -t \$IMAGE_NAME .

          echo "🌐 Ensuring faas-network exists..."
          docker network create faas-network 2>/dev/null || true

          echo "♻️  Replacing running container..."
          docker stop \$FUNCTION_NAME 2>/dev/null || true
          docker rm \$FUNCTION_NAME 2>/dev/null || true

          echo "🚀 Starting \${FUNCTION_NAME}..."
          docker run -d \\
            --name \$FUNCTION_NAME \\
            --network faas-network \\
            --label faas.fn=true \\
            --restart unless-stopped \\
            \$IMAGE_NAME

          echo "✅ Deployed: \${FUNCTION_NAME}"
          echo "🌐 Available at gateway: /\${FUNCTION_NAME}"
`
}

// ─────────────────────────────────────────────────────────────────
// GitHub Actions workflow
// ─────────────────────────────────────────────────────────────────

function generateGitHubWorkflow(functionName: string): string {
  return `# FaaS Deploy — GitHub Actions
# Builds image, pushes to GHCR, and deploys to remote server via SSH
# 
# Required GitHub Secrets:
#   DEPLOY_HOST    - Remote server IP or hostname
#   DEPLOY_USER    - SSH username (e.g. root)
#   DEPLOY_SSH_KEY - Private SSH key for the server

name: Deploy Function

on:
  push:
    branches: [main]

env:
  FUNCTION_NAME: ${functionName}
  REGISTRY: ghcr.io

jobs:
  deploy:
    runs-on: ubuntu-latest

    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: \${{ env.REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push image
        run: |
          IMAGE="\${{ env.REGISTRY }}/\${{ github.repository_owner }}/\${{ env.FUNCTION_NAME }}:latest"
          docker build -t \$IMAGE .
          docker push \$IMAGE
          echo "IMAGE=\$IMAGE" >> \$GITHUB_ENV

      - name: Deploy to server
        uses: appleboy/ssh-action@v1
        with:
          host: \${{ secrets.DEPLOY_HOST }}
          username: \${{ secrets.DEPLOY_USER }}
          key: \${{ secrets.DEPLOY_SSH_KEY }}
          script: |
            IMAGE="\${{ env.REGISTRY }}/\${{ github.repository_owner }}/\${{ env.FUNCTION_NAME }}:latest"

            echo "🔑 Logging in to GHCR..."
            echo "\${{ secrets.GITHUB_TOKEN }}" | docker login ghcr.io -u "\${{ github.actor }}" --password-stdin

            echo "📦 Pulling \$IMAGE..."
            docker pull \$IMAGE

            echo "🌐 Ensuring faas-network exists..."
            docker network create faas-network 2>/dev/null || true

            echo "♻️  Replacing running container..."
            docker stop \${{ env.FUNCTION_NAME }} 2>/dev/null || true
            docker rm \${{ env.FUNCTION_NAME }} 2>/dev/null || true

            echo "🚀 Starting \${{ env.FUNCTION_NAME }}..."
            docker run -d \\
              --name \${{ env.FUNCTION_NAME }} \\
              --network faas-network \\
              --label faas.fn=true \\
              --restart unless-stopped \\
              \$IMAGE

            echo "✅ Deployed: \${{ env.FUNCTION_NAME }}"
`
}

// ─────────────────────────────────────────────────────────────────
// Commands
// ─────────────────────────────────────────────────────────────────

export interface DeployOptions {
  provider?: 'forgejo' | 'github'
  output?: string
}

export async function deployInit(
  options: DeployOptions = {},
): Promise<boolean> {
  const provider = options.provider || 'forgejo'
  const projectDir = resolve(process.cwd())
  const projectName = basename(projectDir)

  logger.title(
    `Setting up ${provider === 'forgejo' ? 'Forgejo' : 'GitHub'} deploy workflow`,
  )

  // Determine workflow directory and file
  const workflowDir =
    provider === 'forgejo'
      ? join(projectDir, '.forgejo', 'workflows')
      : join(projectDir, '.github', 'workflows')

  const workflowFile = join(workflowDir, 'deploy.yml')

  if (existsSync(workflowFile)) {
    logger.error('Deploy workflow already exists')
    logger.dim(`  ${workflowFile}`)
    return false
  }

  // Generate workflow
  const workflow =
    provider === 'forgejo'
      ? generateForgejoWorkflow(projectName)
      : generateGitHubWorkflow(projectName)

  // Write workflow file
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(workflowFile, workflow)
  logger.success(
    `Created ${provider === 'forgejo' ? '.forgejo' : '.github'}/workflows/deploy.yml`,
  )

  logger.newline()

  if (provider === 'forgejo') {
    logger.success('Forgejo deploy workflow ready!')
    logger.newline()
    logger.info('How it works:')
    logger.dim('  1. Push to main branch')
    logger.dim('  2. Forgejo runner builds the Docker image')
    logger.dim(`  3. Container "${projectName}" deploys to faas-network`)
    logger.dim(`  4. Available at gateway: /${projectName}`)
    logger.newline()
    logger.info('Prerequisites:')
    logger.dim('  - Forgejo Actions enabled')
    logger.dim(
      '  - Forgejo runner with Docker socket access (faas deploy runner)',
    )
    logger.newline()
  } else {
    logger.success('GitHub Actions deploy workflow ready!')
    logger.newline()
    logger.info('Required GitHub Secrets:')
    logger.dim('  DEPLOY_HOST    — Remote server IP or hostname')
    logger.dim('  DEPLOY_USER    — SSH username (e.g. root)')
    logger.dim('  DEPLOY_SSH_KEY — Private SSH key for the server')
    logger.newline()
    logger.info('Set these at: Settings → Secrets and variables → Actions')
    logger.newline()
    logger.info('How it works:')
    logger.dim('  1. Push to main branch')
    logger.dim('  2. GitHub Actions builds image, pushes to ghcr.io')
    logger.dim(
      `  3. SSHs to server, pulls image, deploys "${projectName}" to faas-network`,
    )
    logger.dim(`  4. Available at gateway: /${projectName}`)
    logger.newline()
  }

  return true
}

export async function deployRunner(
  options: DeployOptions = {},
): Promise<boolean> {
  const outputDir = options.output || RUNNER_DIR
  const targetDir = resolve(process.cwd(), outputDir)

  logger.title('Creating Forgejo Actions Runner')

  if (existsSync(targetDir)) {
    logger.error(`Directory already exists: ${outputDir}`)
    return false
  }

  // Create directory
  mkdirSync(targetDir, { recursive: true })

  // Write files
  const files: Record<string, string> = {
    'docker-compose.yml': RUNNER_DOCKER_COMPOSE.trim(),
    'README.md': RUNNER_README.trim(),
  }

  for (const [filename, content] of Object.entries(files)) {
    const filePath = join(targetDir, filename)
    writeFileSync(filePath, content)
    logger.success(`Created ${filename}`)
  }

  logger.newline()
  logger.success(`Runner files created in ${outputDir}/`)
  logger.newline()

  // Print setup instructions
  console.log(
    '╔════════════════════════════════════════════════════════════════╗',
  )
  console.log(
    '║                  🏃 Runner Setup Steps                       ║',
  )
  console.log(
    '╚════════════════════════════════════════════════════════════════╝',
  )
  console.log('')
  console.log('   1. Enable Actions in Forgejo:')
  console.log('      Site Administration → Actions → Enable')
  console.log('')
  console.log('      Or add env var to Forgejo service:')
  logger.dim('      FORGEJO__actions__ENABLED=true')
  console.log('')
  console.log('   2. Get a runner registration token:')
  console.log(
    '      Site Administration → Actions → Runners → Create new runner',
  )
  console.log('')
  console.log(`   3. Register the runner (run from ${outputDir}/):`)
  logger.dim(`      cd ${outputDir}`)
  logger.dim('      docker compose run --rm forgejo-runner \\')
  logger.dim('        forgejo-runner register \\')
  logger.dim('        --instance https://your-forgejo-url \\')
  logger.dim('        --token YOUR_REGISTRATION_TOKEN \\')
  logger.dim('        --name faas-runner \\')
  logger.dim('        --labels docker:docker://node:20 \\')
  logger.dim('        --no-interactive')
  console.log('')
  console.log('   4. Start the runner:')
  logger.dim(`      docker compose up -d`)
  console.log('')
  console.log('   5. Verify in Forgejo:')
  console.log('      Site Administration → Actions → Runners')
  console.log('      The runner should appear as online')
  console.log('')

  return true
}

export async function deploy(
  subcommand: string,
  options: DeployOptions = {},
): Promise<boolean> {
  switch (subcommand) {
    case 'init':
      return deployInit(options)
    case 'runner':
      return deployRunner(options)
    default:
      logger.error(`Unknown deploy command: ${subcommand}`)
      logger.info('Available commands: init, runner')
      logger.newline()
      logger.dim(
        '  faas deploy init                  — Generate deploy workflow (Forgejo)',
      )
      logger.dim(
        '  faas deploy init --provider github — Generate deploy workflow (GitHub)',
      )
      logger.dim(
        '  faas deploy runner                — Generate Forgejo runner setup',
      )
      return false
  }
}

export default deploy
