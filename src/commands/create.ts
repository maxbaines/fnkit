// Create command - scaffold a new function project

import { existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join, resolve, dirname } from 'path'
import logger from '../utils/logger'
import * as git from '../utils/git'
import { execStream } from '../utils/shell'
import { getRuntime, getRuntimeNames } from '../runtimes'

export interface CreateOptions {
  remote?: string
  skipInstall?: boolean
}

export async function create(
  runtimeName: string,
  projectName: string,
  options: CreateOptions = {},
): Promise<boolean> {
  const runtime = getRuntime(runtimeName)

  if (!runtime) {
    logger.error(`Unknown runtime: ${runtimeName}`)
    logger.info(`Available runtimes: ${getRuntimeNames().join(', ')}`)
    return false
  }

  const targetDir = resolve(process.cwd(), projectName)

  // Check if directory already exists
  if (existsSync(targetDir)) {
    logger.error(`Directory already exists: ${projectName}`)
    return false
  }

  logger.title(`Creating ${runtime.displayName} function: ${projectName}`)

  // Check if runtime is installed
  const isInstalled = await runtime.isInstalled()
  if (!isInstalled) {
    logger.warn(`${runtime.displayName} is not installed`)
    logger.dim(runtime.installHint)
  } else {
    const version = await runtime.getVersion()
    if (version) {
      logger.success(`${runtime.displayName} detected: ${version}`)
    }
  }

  // Generate project from template
  logger.step('Generating project files...')
  const template = runtime.generateProject(projectName)

  // Create target directory
  await mkdir(targetDir, { recursive: true })

  // Write all template files
  for (const [filename, content] of Object.entries(template.files)) {
    const filePath = join(targetDir, filename)
    const fileDir = dirname(filePath)

    // Create subdirectories if needed
    if (fileDir !== targetDir) {
      await mkdir(fileDir, { recursive: true })
    }

    await writeFile(filePath, content)
    logger.dim(`  Created ${filename}`)
  }

  // Initialize git repo
  logger.step('Initializing git repository...')
  await git.init(targetDir)

  // Add remote if specified
  if (options.remote) {
    logger.step(`Adding remote: ${options.remote}`)
    await git.addRemote(targetDir, 'origin', options.remote)
  }

  // Create Dockerfile
  logger.step('Creating Dockerfile...')
  const dockerfile = runtime.generateDockerfile(projectName, 'helloWorld')
  await writeFile(join(targetDir, 'Dockerfile'), dockerfile)

  // Create .gitignore
  logger.step('Creating .gitignore...')
  const gitignore = generateGitignore(runtime.name)
  await writeFile(join(targetDir, '.gitignore'), gitignore)

  // Run post-create commands (e.g., npm install)
  if (
    !options.skipInstall &&
    template.postCreate &&
    template.postCreate.length > 0
  ) {
    logger.step('Installing dependencies...')
    for (const cmd of template.postCreate) {
      const [command, ...args] = cmd.split(' ')
      logger.dim(`  Running: ${cmd}`)
      const exitCode = await execStream(command, args, { cwd: targetDir })
      if (exitCode !== 0) {
        logger.warn(`Command "${cmd}" exited with code ${exitCode}`)
      }
    }
  }

  logger.newline()
  logger.success(`Created ${runtime.displayName} function in ./${projectName}`)
  logger.newline()
  logger.info('Next steps:')
  logger.dim(`  cd ${projectName}`)
  logger.dim('  faas run')
  logger.newline()
  logger.dim(`Quickstart guide: ${runtime.quickstartUrl}`)
  logger.newline()

  return true
}

function generateGitignore(runtimeName: string): string {
  const common = `# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Docker
Dockerfile.local
`

  const runtimeSpecific: Record<string, string> = {
    nodejs: `# Node.js
node_modules/
npm-debug.log
yarn-error.log
.env
`,
    python: `# Python
__pycache__/
*.py[cod]
.env
venv/
.venv/
`,
    go: `# Go
vendor/
*.exe
`,
    java: `# Java
target/
*.class
*.jar
`,
    ruby: `# Ruby
vendor/bundle/
.bundle/
Gemfile.lock
`,
    dotnet: `# .NET
bin/
obj/
*.user
`,
    php: `# PHP
vendor/
composer.lock
`,
    dart: `# Dart
.dart_tool/
.packages
build/
pubspec.lock
`,
    cpp: `# C++
build/
*.o
*.a
`,
  }

  return common + (runtimeSpecific[runtimeName] || '')
}

export default create
