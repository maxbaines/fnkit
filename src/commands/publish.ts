// Publish command - build deployable container using Google Cloud Buildpacks

import { existsSync } from 'fs'
import { basename, resolve } from 'path'
import logger from '../utils/logger'
import * as pack from '../utils/pack'
import * as docker from '../utils/docker'

export interface PublishOptions {
  tag?: string
  target?: string
  registry?: string
  push?: boolean
}

export async function publish(options: PublishOptions = {}): Promise<boolean> {
  const projectDir = resolve(process.cwd())
  const projectName = basename(projectDir)

  logger.title(`Publishing: ${projectName}`)

  // Check pack CLI availability
  if (!(await pack.isPackAvailable())) {
    logger.error('pack CLI is not installed')
    logger.dim(pack.PACK_INSTALL_HINT)
    return false
  }

  const packVersion = await pack.getPackVersion()
  logger.success(`pack CLI: ${packVersion}`)

  // Check Docker availability (required by pack)
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

  // Determine tag
  const tag = options.tag || `${projectName}:latest`
  const fullTag = options.registry ? `${options.registry}/${tag}` : tag

  // Detect function target from common patterns
  const target = options.target || detectFunctionTarget(projectDir)

  // Build with buildpacks
  const buildSuccess = await pack.build(projectDir, {
    tag: fullTag,
    target,
    signatureType: 'http',
  })

  if (!buildSuccess) {
    logger.error('Build failed')
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
  logger.info('Test it:')
  logger.dim('  curl http://localhost:8080')
  logger.newline()

  return true
}

function detectFunctionTarget(projectDir: string): string {
  // Try to detect function name from common patterns
  // Default to 'helloWorld' which is the common example name

  // Check for package.json with main field
  const packageJsonPath = `${projectDir}/package.json`
  if (existsSync(packageJsonPath)) {
    try {
      const pkg = require(packageJsonPath)
      if (pkg.main) {
        // Extract function name from main if it looks like a function export
        return 'helloWorld'
      }
    } catch {}
  }

  return 'helloWorld'
}

export default publish
