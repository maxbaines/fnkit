// Runtime registry - all supported runtimes

import type { Runtime, RuntimeConfig } from './base'
export type { Runtime, RuntimeConfig }

// Import all runtimes from individual files
import { nodejs } from './nodejs'
import { python } from './python'
import { go } from './go'
import { java } from './java'
import { ruby } from './ruby'
import { dotnet } from './dotnet'
import { php } from './php'
import { dart } from './dart'
import { cpp } from './cpp'

// Canonical runtime names only - no aliases
export const runtimes: Record<string, Runtime> = {
  node: nodejs,
  python,
  go,
  java,
  ruby,
  dotnet,
  php,
  dart,
  cpp,
}

export function getRuntime(name: string): Runtime | undefined {
  return runtimes[name.toLowerCase()]
}

export function getAllRuntimes(): Runtime[] {
  return Object.values(runtimes)
}

export function getRuntimeNames(): string[] {
  return Object.keys(runtimes)
}
