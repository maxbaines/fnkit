// Create command - scaffold a new function project

import { existsSync } from 'fs'
import { mkdir, rm, readdir, rename, writeFile } from 'fs/promises'
import { join, resolve } from 'path'
import logger from '../utils/logger'
import * as git from '../utils/git'
import { getRuntime, getRuntimeNames } from '../runtimes'

export interface CreateOptions {
  remote?: string
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

  // Clone the functions framework repo to a temp location outside target
  const tempDir = join(resolve(process.cwd()), `.faas-temp-${Date.now()}`)
  const cloneSuccess = await git.clone(runtime.repo, tempDir, { depth: 1 })

  if (!cloneSuccess) {
    logger.error('Failed to clone repository')
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    return false
  }

  try {
    // Find example/template directory
    const exampleDir = await findExampleDir(tempDir, runtime.name)

    if (exampleDir) {
      // Copy example to target directory
      const { cp } = await import('fs/promises')
      await cp(exampleDir, targetDir, { recursive: true })
    } else {
      // No example found, copy the whole repo
      const { cp } = await import('fs/promises')
      await cp(tempDir, targetDir, { recursive: true })
      await git.removeGitHistory(targetDir)
    }
  } finally {
    // Always clean up temp directory
    await rm(tempDir, { recursive: true, force: true }).catch(() => {})
  }

  // Initialize fresh git repo
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

  logger.newline()
  logger.success(`Created ${runtime.displayName} function in ./${projectName}`)
  logger.newline()
  logger.info('Next steps:')
  logger.dim(`  cd ${projectName}`)
  if (runtime.name === 'nodejs') {
    logger.dim('  npm install')
  } else if (runtime.name === 'python') {
    logger.dim('  pip install -r requirements.txt')
  } else if (runtime.name === 'go') {
    logger.dim('  go mod tidy')
  } else if (runtime.name === 'dotnet') {
    logger.dim('  dotnet restore')
  } else if (runtime.name === 'ruby') {
    logger.dim('  bundle install')
  } else if (runtime.name === 'php') {
    logger.dim('  composer install')
  } else if (runtime.name === 'dart') {
    logger.dim('  dart pub get')
  } else if (runtime.name === 'java') {
    logger.dim('  mvn install')
  }
  logger.dim('  faas run')
  logger.newline()

  return true
}

async function findExampleDir(
  repoDir: string,
  runtimeName: string,
): Promise<string | null> {
  // Common example directory patterns
  const patterns = [
    'examples/hello',
    'examples/helloworld',
    'examples/hello-world',
    'example',
    'examples',
    'sample',
    'samples/hello',
    'quickstart',
  ]

  for (const pattern of patterns) {
    const dir = join(repoDir, pattern)
    if (existsSync(dir)) {
      return dir
    }
  }

  return null
}

export default create
