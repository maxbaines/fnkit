// List deployed faas containers

import {
  isDockerAvailable,
  isDockerRunning,
  listContainers,
  type ContainerInfo,
} from '../utils/docker'
import logger from '../utils/logger'

export interface ContainersOptions {
  all?: boolean // Show all containers, not just faas.fn labeled ones
}

export async function containers(
  options: ContainersOptions = {},
): Promise<boolean> {
  // Check Docker availability
  if (!(await isDockerAvailable())) {
    logger.error('Docker is not installed')
    return false
  }

  if (!(await isDockerRunning())) {
    logger.error('Docker is not running')
    return false
  }

  console.log(
    '╔════════════════════════════════════════════════════════════════╗',
  )
  console.log(
    '║                    🐳 FAAS Containers                          ║',
  )
  console.log(
    '╚════════════════════════════════════════════════════════════════╝',
  )
  console.log('')

  // Get containers - filter by faas.fn label unless --all is specified
  const labelFilter = options.all ? undefined : 'faas.fn=true'
  const containerList = await listContainers(labelFilter)

  if (containerList.length === 0) {
    if (options.all) {
      console.log('   No containers found.')
    } else {
      console.log('   No faas containers found.')
      console.log('')
      console.log(
        '   Containers must have the label faas.fn=true to appear here.',
      )
      console.log('   Use --all to show all containers.')
    }
    console.log('')
    return true
  }

  // Calculate column widths
  const nameWidth = Math.max(12, ...containerList.map((c) => c.name.length))
  const projectWidth = Math.max(
    10,
    ...containerList.map(
      (c) => (c.labels['coolify.projectName'] || '-').length,
    ),
  )
  const serviceWidth = Math.max(
    10,
    ...containerList.map((c) => (c.labels['coolify.name'] || '-').length),
  )

  // Print header
  console.log(
    `   ${'NAME'.padEnd(nameWidth)}  STATUS     ${'PROJECT'.padEnd(projectWidth)}  ${'SERVICE'.padEnd(serviceWidth)}  URL`,
  )
  console.log(`   ${'─'.repeat(nameWidth + projectWidth + serviceWidth + 50)}`)

  // Print containers
  for (const container of containerList) {
    const isRunning = container.state === 'running'
    const statusIcon = isRunning ? '🟢' : '⚫'
    const statusText = isRunning ? 'running' : 'stopped'

    const projectName = container.labels['coolify.projectName'] || '-'
    const serviceName = container.labels['coolify.name'] || '-'
    const url = container.labels['caddy_0'] || '-'

    console.log(
      `   ${statusIcon} ${container.name.padEnd(nameWidth)}  ${statusText.padEnd(9)}  ${projectName.padEnd(projectWidth)}  ${serviceName.padEnd(serviceWidth)}  ${url}`,
    )
  }

  console.log('')

  // Summary
  const running = containerList.filter((c) => c.state === 'running').length
  const stopped = containerList.length - running
  console.log(`   Summary: ${running} running, ${stopped} stopped`)
  console.log('')

  // Commands hint
  console.log('   Commands:')
  console.log('   - Logs:   docker logs <name>')
  console.log('   - Shell:  docker exec -it <name> sh')
  console.log('   - Stop:   docker stop <name>')
  console.log('   - Remove: docker rm <name>')
  console.log('')

  return true
}
