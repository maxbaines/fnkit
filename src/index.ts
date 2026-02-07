#!/usr/bin/env bun
// FAAS CLI - Functions as a Service scaffolding tool

import { create } from './commands/create'
import { publish } from './commands/publish'
import { doctor } from './commands/doctor'
import { run } from './commands/run'
import { init } from './commands/init'
import { global, uninstall } from './commands/global'
import { containers } from './commands/containers'
import { getRuntimeNames } from './runtimes'
import logger from './utils/logger'

const VERSION = '0.6.7'

function showHelp() {
  console.log(`
faas - Functions as a Service CLI

Usage:
  faas <command> [options]
  faas <runtime> <name>     Create a new function (shorthand)

Commands:
  create, c <runtime> <name>   Create a new function project
  init                         Initialize existing project as function
  run, dev                     Run function locally
  publish, p                   Build Docker container
  containers, ls               List deployed faas containers
  doctor [runtime]             Check runtime dependencies
  global                       Install faas globally (requires sudo)
  uninstall                    Remove global installation
  help                         Show this help message
  version                      Show version

Runtimes:
  ${getRuntimeNames().join(', ')}

Examples:
  faas nodejs hello            Create Node.js function named "hello"
  faas create dotnet api       Create .NET function named "api"
  faas c python myfunction     Create Python function
  faas init                    Initialize current directory
  faas run                     Run function locally
  faas publish                 Build Docker container
  faas publish --tag myapp:v1  Build with custom tag
  faas doctor                  Check all runtimes
  faas doctor nodejs           Check Node.js specifically

Options:
  --remote, -r <url>           Set git remote for create
  --tag, -t <tag>              Docker image tag for publish
  --registry <registry>        Docker registry for publish
  --push                       Push image after build
  --target <function>          Function target for run
  --port <port>                Port for run
  --runtime <runtime>          Runtime for init
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

      case 'create':
      case 'c':
        if (positionalArgs.length < 2) {
          logger.error('Usage: faas create <runtime> <name>')
          process.exit(1)
        }
        const createSuccess = await create(
          positionalArgs[0],
          positionalArgs[1],
          {
            remote: options.remote as string,
          },
        )
        process.exit(createSuccess ? 0 : 1)
        break

      case 'init':
        const initSuccess = await init({
          runtime: options.runtime as string,
        })
        process.exit(initSuccess ? 0 : 1)
        break

      case 'run':
      case 'dev':
        const runSuccess = await run({
          target: options.target as string,
          port: options.port ? parseInt(options.port as string) : undefined,
        })
        process.exit(runSuccess ? 0 : 1)
        break

      case 'publish':
      case 'p':
        const publishSuccess = await publish({
          tag: options.tag as string,
          target: options.target as string,
          registry: options.registry as string,
          push: options.push as boolean,
        })
        process.exit(publishSuccess ? 0 : 1)
        break

      case 'doctor':
        const doctorSuccess = await doctor(positionalArgs[0])
        process.exit(doctorSuccess ? 0 : 1)
        break

      case 'containers':
      case 'ls':
        const containersSuccess = await containers({
          all: options.all as boolean,
        })
        process.exit(containersSuccess ? 0 : 1)
        break

      case 'global':
        const globalSuccess = await global()
        process.exit(globalSuccess ? 0 : 1)
        break

      case 'uninstall':
        const uninstallSuccess = await uninstall()
        process.exit(uninstallSuccess ? 0 : 1)
        break

      default:
        // Check if command is a runtime name (shorthand for create)
        const runtimeNames = getRuntimeNames()
        if (runtimeNames.includes(command.toLowerCase())) {
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
