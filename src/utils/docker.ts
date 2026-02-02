// Docker utility functions

import { exec, execStream, commandExists } from './shell'
import logger from './logger'

export async function isDockerAvailable(): Promise<boolean> {
  return await commandExists('docker')
}

export async function isDockerRunning(): Promise<boolean> {
  const result = await exec('docker', ['info'])
  return result.success
}

export async function build(
  contextDir: string,
  options: {
    tag?: string
    dockerfile?: string
    buildArgs?: Record<string, string>
  } = {},
): Promise<boolean> {
  const args = ['build']

  if (options.tag) {
    args.push('-t', options.tag)
  }

  if (options.dockerfile) {
    args.push('-f', options.dockerfile)
  }

  if (options.buildArgs) {
    for (const [key, value] of Object.entries(options.buildArgs)) {
      args.push('--build-arg', `${key}=${value}`)
    }
  }

  args.push(contextDir)

  logger.step(`Building Docker image...`)
  const exitCode = await execStream('docker', args)
  return exitCode === 0
}

export async function push(tag: string): Promise<boolean> {
  logger.step(`Pushing ${tag}...`)
  const exitCode = await execStream('docker', ['push', tag])
  return exitCode === 0
}

export async function tag(source: string, target: string): Promise<boolean> {
  const result = await exec('docker', ['tag', source, target])
  return result.success
}

export async function imageExists(tag: string): Promise<boolean> {
  const result = await exec('docker', ['image', 'inspect', tag])
  return result.success
}
