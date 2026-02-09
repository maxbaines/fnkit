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
import { getRuntimeNames } from './runtimes'
import logger from './utils/logger'

const VERSION = '0.7.0'

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
faas - Functions as a Service CLI

Usage:
  faas <command> [subcommand] [options]
  faas <runtime> <name>           Quick create (shorthand)

Commands:
  new <runtime> <name>            Create a new function
  init                            Initialize existing directory
  dev                             Run function locally

  container ls                    List deployed containers
  container logs <name>           View container logs
  container stop <name>           Stop a container

  gateway init                    Create gateway project
  gateway build                   Build gateway image
  gateway start                   Start gateway
  gateway stop                    Stop gateway

  image build                     Build Docker image
  image push                      Push to registry

  doctor [runtime]                Check dependencies
  install                         Install faas globally
  uninstall                       Uninstall faas globally

Runtimes:
  ${CANONICAL_RUNTIMES.join(', ')}

Examples:
  faas node hello                 Create Node.js function
  faas new python api             Create Python function
  faas dev                        Run locally
  faas dev --port 3000            Run on specific port
  faas image build                Build Docker image
  faas image build --tag v1       Build with custom tag
  faas image push --registry gcr  Push to registry
  faas container ls               List containers
  faas gateway start --token xyz  Start gateway with auth
  faas doctor node                Check Node.js dependencies

Options:
  --remote, -r <url>              Git remote for new/init
  --tag, -t <tag>                 Docker image tag
  --registry <registry>           Docker registry
  --push                          Push after build
  --target <function>             Function target
  --port, -p <port>               Port for dev server
  --runtime <runtime>             Runtime for init
  --token <token>                 Auth token for gateway
  --all                           Show all containers
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
        if (!containerSubcmd) {
          logger.error('Usage: faas container <ls|logs|stop> [name]')
          process.exit(1)
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
        if (!gatewaySubcmd) {
          logger.error('Usage: faas gateway <init|build|start|stop>')
          logger.info('  init   - Create gateway project files')
          logger.info('  build  - Build the gateway Docker image')
          logger.info('  start  - Start the gateway container')
          logger.info('  stop   - Stop the gateway container')
          process.exit(1)
        }
        const gatewaySuccess = await gateway(gatewaySubcmd, {
          output: options.output as string,
          token: options.token as string,
        })
        process.exit(gatewaySuccess ? 0 : 1)
        break

      // ─────────────────────────────────────────────────────────────────
      // Image management: faas image <subcommand>
      // ─────────────────────────────────────────────────────────────────

      case 'image':
        const imageSubcmd = positionalArgs[0]
        if (!imageSubcmd) {
          logger.error('Usage: faas image <build|push>')
          process.exit(1)
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
