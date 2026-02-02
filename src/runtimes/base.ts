// Base runtime interface and types

export interface ProjectTemplate {
  files: Record<string, string> // filename -> content
  postCreate?: string[] // commands to run after creating files (e.g., npm install)
}

export interface RuntimeConfig {
  name: string
  displayName: string
  repo: string
  quickstartUrl: string
  checkCommand: string
  checkArgs: string[]
  installHint: string
  dockerfile: string
  runCommand: string[]
  devCommand?: string[]
  filePatterns: string[] // Files that identify this runtime
  template: (projectName: string) => ProjectTemplate
}

export interface Runtime extends RuntimeConfig {
  isInstalled(): Promise<boolean>
  getVersion(): Promise<string | null>
  generateDockerfile(projectName: string, entrypoint?: string): string
  generateProject(projectName: string): ProjectTemplate
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
        .replace(/\{\{ENTRYPOINT\}\}/g, entrypoint || 'helloWorld')
    },
    generateProject(projectName: string): ProjectTemplate {
      return config.template(projectName)
    },
  }
}
