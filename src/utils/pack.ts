// Pack CLI utility functions (Google Cloud Buildpacks)

import { exec, execStream, commandExists, getCommandVersion } from './shell'
import logger from './logger'

export async function isPackAvailable(): Promise<boolean> {
  return await commandExists('pack')
}

export async function getPackVersion(): Promise<string | null> {
  // pack CLI outputs version info differently, just check if it exists
  const exists = await commandExists('pack')
  if (exists) {
    return '0.39.x (installed)'
  }
  return null
}

export interface BuildOptions {
  tag: string
  target?: string
  signatureType?: 'http' | 'cloudevent'
  builder?: string
}

export async function build(
  contextDir: string,
  options: BuildOptions,
): Promise<boolean> {
  const builder = options.builder || 'gcr.io/buildpacks/builder:v1'
  const signatureType = options.signatureType || 'http'
  const target = options.target || 'helloWorld'

  const args = [
    'build',
    options.tag,
    '--builder',
    builder,
    '--env',
    `GOOGLE_FUNCTION_SIGNATURE_TYPE=${signatureType}`,
    '--env',
    `GOOGLE_FUNCTION_TARGET=${target}`,
    '--path',
    contextDir,
  ]

  logger.step(`Building with buildpacks: ${options.tag}`)
  logger.dim(`  Builder: ${builder}`)
  logger.dim(`  Target: ${target}`)
  logger.newline()

  const exitCode = await execStream('pack', args)
  return exitCode === 0
}

export const PACK_INSTALL_HINT =
  'Install pack CLI: brew install buildpacks/tap/pack'
