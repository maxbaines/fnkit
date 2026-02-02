// Publish command - build Docker container

import { existsSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join, basename, resolve } from 'path'
import logger from '../utils/logger'
import * as docker from '../utils/docker'
import { getAllRuntimes, type Runtime } from '../runtimes'

export interface PublishOptions {
  tag?: string
  registry?: string
  push?: boolean
}

export async function publish(options: PublishOptions = {}): Promise<boolean> {
  const projectDir = resolve(process.cwd())
  const projectName = basename(projectDir)

  logger.title(`Publishing: ${projectName}`)

  // Check Docker availability
  if (!(await docker.isDockerAvailable())) {
    logger.error('Docker is not installed')
    logger.dim('Install Docker from https://docker.com')
    return false
  }

  if (!(await docker.isDockerRunning())) {
    logger.error('Docker is not running')
    logger.dim('Please start Docker and try again')
    return false
  }

  logger.success('Docker is available')

  // Detect runtime
  const runtime = await detectRuntime(projectDir)
  if (!runtime) {
    logger.error('Could not detect runtime')
    logger.info('Make sure you are in a function project directory')
    return false
  }

  logger.success(`Detected runtime: ${runtime.displayName}`)

  // Check/create Dockerfile
  const dockerfilePath = join(projectDir, 'Dockerfile')
  if (!existsSync(dockerfilePath)) {
    logger.step('Creating Dockerfile...')
    const dockerfile = runtime.generateDockerfile(projectName, 'helloWorld')
    await writeFile(dockerfilePath, dockerfile)
    logger.success('Created Dockerfile')
  }

  // Determine tag
  const tag = options.tag || `${projectName}:latest`
  const fullTag = options.registry ? `${options.registry}/${tag}` : tag

  // Build image
  logger.step(`Building image: ${fullTag}`)
  const buildSuccess = await docker.build(projectDir, { tag: fullTag })

  if (!buildSuccess) {
    logger.error('Docker build failed')
    return false
  }

  logger.success(`Built image: ${fullTag}`)

  // Push if requested
  if (options.push && options.registry) {
    logger.step(`Pushing to ${options.registry}...`)
    const pushSuccess = await docker.push(fullTag)
    if (!pushSuccess) {
      logger.error('Failed to push image')
      return false
    }
    logger.success(`Pushed: ${fullTag}`)
  }

  logger.newline()
  logger.success('Publish complete!')
  logger.newline()
  logger.info('Run your container:')
  logger.dim(`  docker run -p 8080:8080 ${fullTag}`)
  logger.newline()

  return true
}

async function detectRuntime(projectDir: string): Promise<Runtime | null> {
  const runtimes = getAllRuntimes()

  for (const runtime of runtimes) {
    for (const pattern of runtime.filePatterns) {
      // Handle glob patterns simply
      if (pattern.includes('*')) {
        const { readdir } = await import('fs/promises')
        const files = await readdir(projectDir)
        const ext = pattern.replace('*', '')
        if (files.some((f) => f.endsWith(ext))) {
          return runtime
        }
      } else {
        const filePath = join(projectDir, pattern)
        if (existsSync(filePath)) {
          return runtime
        }
      }
    }
  }

  return null
}

export default publish
