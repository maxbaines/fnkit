// Base runtime interface and types

export interface RuntimeConfig {
  name: string
  displayName: string
  repo: string
  checkCommand: string
  checkArgs: string[]
  installHint: string
  dockerfile: string
  runCommand: string[]
  devCommand?: string[]
  filePatterns: string[] // Files that identify this runtime
}

export interface Runtime extends RuntimeConfig {
  isInstalled(): Promise<boolean>
  getVersion(): Promise<string | null>
  generateDockerfile(projectName: string, entrypoint?: string): string
}

import { commandExists, getCommandVersion } from '../utils/shell'

export function createRuntime(config: RuntimeConfig): Runtime {
  return {
    ...config,
    async isInstalled(): Promise<boolean> {
      return await commandExists(config.checkCommand)
    },
    async getVersion(): Promise<string | null> {
      return await getCommandVersion(config.checkCommand, config.checkArgs[0])
    },
    generateDockerfile(projectName: string, entrypoint?: string): string {
      return config.dockerfile
        .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
        .replace(/\{\{ENTRYPOINT\}\}/g, entrypoint || 'index')
    },
  }
}
