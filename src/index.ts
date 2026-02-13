#!/usr/bin/env bun
// FAAS CLI - Functions as a Service scaffolding tool

import { create } from './commands/create'
import { publish } from './commands/publish'
import { doctor } from './commands/doctor'
import { run } from './commands/run'
import { init } from './commands/init'
import { global, uninstall } from './commands/global'
import { containers } from './commands/containers'
import { gateway } from './commands/gateway'
import { deploy } from './commands/deploy'
import { proxy } from './commands/proxy'
import logger from './utils/logger'

const VERSION = '0.7.1'

// Canonical runtime names only
const CANONICAL_RUNTIMES = [
  'node',
  'python',
  'go',
  'java',
  'ruby',
  'dotnet',
  'php',
  'dart',
  'cpp',
]

function showHelp() {
  console.log(`
faas v${VERSION} — Functions as a Service CLI

Usage:
  faas <command> [options]
  faas <runtime> <name>              Quick create (shorthand for 'new')

Commands:
  new <runtime> <name>               Create a new function project
  init                               Initialize existing directory
  dev                                Run function locally

  container ...                      Manage deployed containers
  gateway ...                        Manage API gateway
  proxy ...                          Manage reverse proxy (Caddy)
  deploy ...                         Manage CI/CD deploy pipeline
  image ...                          Build & push Docker images

  doctor [runtime]                   Check runtime dependencies
  install                            Install faas globally
  uninstall                          Remove global installation

Runtimes:
  ${CANONICAL_RUNTIMES.join(', ')}

Quick Start:
  faas node my-api                   Create a function
  faas deploy setup                  Set up CI/CD pipeline
  git push                           Deploy to production

Run 'faas <command>' for subcommand details.
`)
}

function showContainerHelp() {
  console.log(`
faas container — Manage deployed containers

Usage:
  faas container <command> [options]

Commands:
  ls                    List deployed faas containers
  logs <name>           View container logs (live)
  stop <name>           Stop a running container

Options:
  --all                 Show all containers (not just faas)

Examples:
  faas container ls             List running functions
  faas container ls --all       Include non-faas containers
  faas container logs my-api    Tail logs for my-api
  faas container stop my-api    Stop my-api container
`)
}

function showGatewayHelp() {
  console.log(`
faas gateway — Manage the API gateway

The gateway provides centralized token authentication and routing
for all your function containers via nginx.

Usage:
  faas gateway <command> [options]

Commands:
  init                  Create gateway project files
  build                 Build the gateway Docker image
  start                 Start the gateway container
  stop                  Stop the gateway container

Options:
  --token <token>       Auth token for the gateway

Examples:
  faas gateway init                    Create gateway project
  faas gateway build                   Build Docker image
  faas gateway start --token secret    Start with auth token
  faas gateway stop                    Stop the gateway
`)
}

function showProxyHelp() {
  console.log(`
faas proxy — Manage reverse proxy (Caddy)

Sets up Caddy for automatic HTTPS and domain management.
Caddy handles TLS certificates via Let's Encrypt automatically.

Usage:
  faas proxy <command> [options]

Commands:
  init                  Create Caddy proxy setup
  add <domain>          Add a domain route to the gateway
  remove <domain>       Remove a domain route
  ls                    List configured domains

Examples:
  faas proxy init                      Create proxy project
  faas proxy add api.example.com       Route domain to gateway
  faas proxy ls                        List all domains
  faas proxy remove api.example.com    Remove domain route
`)
}

function showDeployHelp() {
  console.log(`
faas deploy — Manage CI/CD deploy pipeline

Automated git-push-to-deploy via Forgejo (default) or GitHub Actions.

  Forgejo:  push → runner builds image → deploy container → health check
  GitHub:   push → build & push to GHCR → SSH deploy → health check

Usage:
  faas deploy <command> [options]

Commands:
  setup                 Guided deploy pipeline setup (recommended)
  init                  Generate deploy workflow file
  runner                Generate Forgejo runner setup files
  status                Check deployment status

Options:
  --provider <name>     Deploy provider: forgejo (default) or github

Examples:
  faas deploy setup                    Interactive setup wizard
  faas deploy init                     Generate Forgejo workflow
  faas deploy init --provider github   Generate GitHub Actions workflow
  faas deploy runner                   Create runner docker-compose
  faas deploy status                   Check pipeline & container status
`)
}

function showImageHelp() {
  console.log(`
faas image — Build & push Docker images

Usage:
  faas image <command> [options]

Commands:
  build                 Build Docker image for the current function
  push                  Build and push image to a registry

Options:
  --tag, -t <tag>       Docker image tag (default: function name)
  --registry <url>      Docker registry URL
  --target <function>   Function target name

Examples:
  faas image build                     Build with default tag
  faas image build --tag myapp:v1      Build with custom tag
  faas image push --registry ghcr.io   Build and push to registry
`)
}

function showVersion() {
  console.log(`faas v${VERSION}`)
}

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    showHelp()
    process.exit(0)
  }

  const command = args[0]

  // Parse options
  const options: Record<string, string | boolean> = {}
  const positionalArgs: string[] = []

  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const nextArg = args[i + 1]
      if (nextArg && !nextArg.startsWith('-')) {
        options[key] = nextArg
        i++
      } else {
        options[key] = true
      }
    } else if (arg.startsWith('-')) {
      const key = arg.slice(1)
      const nextArg = args[i + 1]
      // Map short flags
      const keyMap: Record<string, string> = {
        r: 'remote',
        t: 'tag',
        p: 'port',
      }
      const fullKey = keyMap[key] || key
      if (nextArg && !nextArg.startsWith('-')) {
        options[fullKey] = nextArg
        i++
      } else {
        options[fullKey] = true
      }
    } else {
      positionalArgs.push(arg)
    }
  }

  try {
    switch (command) {
      case 'help':
      case '--help':
      case '-h':
        showHelp()
        break

      case 'version':
      case '--version':
      case '-v':
        showVersion()
        break

      // ─────────────────────────────────────────────────────────────────
      // Function creation & development
      // ─────────────────────────────────────────────────────────────────

      case 'new':
        if (positionalArgs.length < 2) {
          logger.error('Usage: faas new <runtime> <name>')
          logger.info(`Runtimes: ${CANONICAL_RUNTIMES.join(', ')}`)
          process.exit(1)
        }
        const newSuccess = await create(positionalArgs[0], positionalArgs[1], {
          remote: options.remote as string,
        })
        process.exit(newSuccess ? 0 : 1)
        break

      case 'init':
        const initSuccess = await init({
          runtime: options.runtime as string,
        })
        process.exit(initSuccess ? 0 : 1)
        break

      case 'dev':
        const devSuccess = await run({
          target: options.target as string,
          port: options.port ? parseInt(options.port as string) : undefined,
        })
        process.exit(devSuccess ? 0 : 1)
        break

      // ─────────────────────────────────────────────────────────────────
      // Container management: faas container <subcommand>
      // ─────────────────────────────────────────────────────────────────

      case 'container':
        const containerSubcmd = positionalArgs[0]
        if (!containerSubcmd || options.help || options.h) {
          showContainerHelp()
          process.exit(0)
        }

        switch (containerSubcmd) {
          case 'ls':
          case 'list':
            const lsSuccess = await containers({
              all: options.all as boolean,
            })
            process.exit(lsSuccess ? 0 : 1)
            break

          case 'logs':
            if (!positionalArgs[1]) {
              logger.error('Usage: faas container logs <name>')
              process.exit(1)
            }
            const { exec } = await import('./utils/shell')
            const logsResult = await exec('docker', [
              'logs',
              '-f',
              positionalArgs[1],
            ])
            process.exit(logsResult.success ? 0 : 1)
            break

          case 'stop':
            if (!positionalArgs[1]) {
              logger.error('Usage: faas container stop <name>')
              process.exit(1)
            }
            const { exec: execStop } = await import('./utils/shell')
            const stopResult = await execStop('docker', [
              'stop',
              positionalArgs[1],
            ])
            if (stopResult.success) {
              logger.success(`Stopped container: ${positionalArgs[1]}`)
            } else {
              logger.error(`Failed to stop container: ${positionalArgs[1]}`)
            }
            process.exit(stopResult.success ? 0 : 1)
            break

          default:
            logger.error(`Unknown container command: ${containerSubcmd}`)
            logger.info('Available: ls, logs, stop')
            process.exit(1)
        }
        break

      // ─────────────────────────────────────────────────────────────────
      // Gateway management: faas gateway <subcommand>
      // ─────────────────────────────────────────────────────────────────

      case 'gateway':
        const gatewaySubcmd = positionalArgs[0]
        if (!gatewaySubcmd || options.help || options.h) {
          showGatewayHelp()
          process.exit(0)
        }
        const gatewaySuccess = await gateway(gatewaySubcmd, {
          output: options.output as string,
          token: options.token as string,
        })
        process.exit(gatewaySuccess ? 0 : 1)
        break

      // ─────────────────────────────────────────────────────────────────
      // Proxy management: faas proxy <subcommand>
      // ─────────────────────────────────────────────────────────────────

      case 'proxy':
        const proxySubcmd = positionalArgs[0]
        if (!proxySubcmd || options.help || options.h) {
          showProxyHelp()
          process.exit(0)
        }
        const proxySuccess = await proxy(proxySubcmd, {
          output: options.output as string,
          domain: positionalArgs[1],
        })
        process.exit(proxySuccess ? 0 : 1)
        break

      // ─────────────────────────────────────────────────────────────────
      // Deploy management: faas deploy <subcommand>
      // ─────────────────────────────────────────────────────────────────

      case 'deploy':
        const deploySubcmd = positionalArgs[0]
        if (!deploySubcmd || options.help || options.h) {
          showDeployHelp()
          process.exit(0)
        }
        const deploySuccess = await deploy(deploySubcmd, {
          provider: options.provider as 'forgejo' | 'github' | undefined,
          output: options.output as string,
        })
        process.exit(deploySuccess ? 0 : 1)
        break

      // ─────────────────────────────────────────────────────────────────
      // Image management: faas image <subcommand>
      // ─────────────────────────────────────────────────────────────────

      case 'image':
        const imageSubcmd = positionalArgs[0]
        if (!imageSubcmd || options.help || options.h) {
          showImageHelp()
          process.exit(0)
        }

        switch (imageSubcmd) {
          case 'build':
            const buildSuccess = await publish({
              tag: options.tag as string,
              target: options.target as string,
              registry: options.registry as string,
              push: false,
            })
            process.exit(buildSuccess ? 0 : 1)
            break

          case 'push':
            const pushSuccess = await publish({
              tag: options.tag as string,
              target: options.target as string,
              registry: options.registry as string,
              push: true,
            })
            process.exit(pushSuccess ? 0 : 1)
            break

          default:
            logger.error(`Unknown image command: ${imageSubcmd}`)
            logger.info('Available: build, push')
            process.exit(1)
        }
        break

      // ─────────────────────────────────────────────────────────────────
      // Utilities
      // ─────────────────────────────────────────────────────────────────

      case 'doctor':
        const doctorSuccess = await doctor(positionalArgs[0])
        process.exit(doctorSuccess ? 0 : 1)
        break

      case 'install':
        const installSuccess = await global()
        process.exit(installSuccess ? 0 : 1)
        break

      case 'uninstall':
        const uninstallSuccess = await uninstall()
        process.exit(uninstallSuccess ? 0 : 1)
        break

      // ─────────────────────────────────────────────────────────────────
      // Shorthand: faas <runtime> <name> → faas new <runtime> <name>
      // ─────────────────────────────────────────────────────────────────

      default:
        // Check if command is a canonical runtime name (shorthand for new)
        if (CANONICAL_RUNTIMES.includes(command.toLowerCase())) {
          if (positionalArgs.length < 1) {
            logger.error(`Usage: faas ${command} <name>`)
            process.exit(1)
          }
          const shorthandSuccess = await create(command, positionalArgs[0], {
            remote: options.remote as string,
          })
          process.exit(shorthandSuccess ? 0 : 1)
        } else {
          logger.error(`Unknown command: ${command}`)
          logger.info('Run "faas help" for usage information')
          process.exit(1)
        }
    }
  } catch (error) {
    logger.error(`Error: ${error instanceof Error ? error.message : error}`)
    process.exit(1)
  }
}

main()
