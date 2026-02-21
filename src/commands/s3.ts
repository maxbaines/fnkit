// S3 command - manage S3/MinIO object storage for fnkit configs

import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { resolve, basename } from 'path'
import logger from '../utils/logger'

const S3_CONFIG_FILE = '.fnkit-s3.json'
const DEFAULT_S3_REGION = 'us-east-1'

interface S3Config {
  bucket: string
  endpoint?: string
  region?: string
}

export interface S3Options {
  bucket?: string
  endpoint?: string
  region?: string
  accessKey?: string
  secretKey?: string
}

// ── Config Management ────────────────────────────────────────────────

function loadS3Config(options: S3Options = {}): S3Config | null {
  const configPath = resolve(process.cwd(), S3_CONFIG_FILE)
  let config: S3Config | null = null

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf-8')) as S3Config
    } catch (error) {
      logger.error(`Failed to parse ${S3_CONFIG_FILE}`)
      logger.dim(`${error instanceof Error ? error.message : error}`)
      return null
    }
  }

  const merged: S3Config = {
    bucket: options.bucket || config?.bucket || '',
    endpoint: options.endpoint ?? config?.endpoint,
    region: options.region ?? config?.region ?? DEFAULT_S3_REGION,
  }

  if (!merged.bucket) {
    logger.error('S3 bucket not configured')
    logger.info('Run: fnkit s3 init --bucket <bucket> [--endpoint <url>]')
    return null
  }

  return merged
}

function buildAwsArgs(config: S3Config, commandArgs: string[]): string[] {
  const args: string[] = []
  if (config.endpoint) {
    args.push('--endpoint-url', config.endpoint)
  }
  if (config.region) {
    args.push('--region', config.region)
  }
  args.push(...commandArgs)
  return args
}

function buildAwsCommand(
  args: string[],
  options: S3Options,
  config: S3Config,
): { command: string; args: string[] } {
  if (options.accessKey || options.secretKey) {
    const envArgs: string[] = []
    if (options.accessKey) {
      envArgs.push(`AWS_ACCESS_KEY_ID=${options.accessKey}`)
    }
    if (options.secretKey) {
      envArgs.push(`AWS_SECRET_ACCESS_KEY=${options.secretKey}`)
    }
    if (config.region) {
      envArgs.push(`AWS_REGION=${config.region}`)
    }
    envArgs.push('aws', ...args)
    return { command: 'env', args: envArgs }
  }

  return { command: 'aws', args }
}

// ── Commands ─────────────────────────────────────────────────────────

export async function s3Init(options: S3Options = {}): Promise<boolean> {
  logger.title('Initializing S3 config')

  if (!options.bucket) {
    logger.error('Usage: fnkit s3 init --bucket <bucket> [--endpoint <url>]')
    return false
  }

  const configPath = resolve(process.cwd(), S3_CONFIG_FILE)
  const config: S3Config = {
    bucket: options.bucket,
    endpoint: options.endpoint,
    region: options.region || DEFAULT_S3_REGION,
  }

  writeFileSync(configPath, JSON.stringify(config, null, 2))
  logger.success(`Saved ${S3_CONFIG_FILE}`)
  logger.dim(`  bucket: ${config.bucket}`)
  if (config.endpoint) {
    logger.dim(`  endpoint: ${config.endpoint}`)
  }
  logger.dim(`  region: ${config.region || DEFAULT_S3_REGION}`)
  logger.newline()

  return true
}

export async function s3MakeBucket(
  bucketName: string | undefined,
  options: S3Options = {},
): Promise<boolean> {
  if (!bucketName) {
    logger.error('Usage: fnkit s3 mb <bucket-name>')
    return false
  }

  logger.title(`Creating S3 bucket: ${bucketName}`)

  const config: S3Config = {
    bucket: bucketName,
    endpoint: options.endpoint,
    region: options.region || DEFAULT_S3_REGION,
  }

  // Try loading saved config for endpoint/region defaults
  const savedConfig = loadS3Config({ ...options, bucket: bucketName })
  if (savedConfig) {
    config.endpoint = config.endpoint || savedConfig.endpoint
    config.region = config.region || savedConfig.region
  }

  const awsArgs = buildAwsArgs(config, ['s3', 'mb', `s3://${bucketName}`])
  const command = buildAwsCommand(awsArgs, options, config)
  const { exec } = await import('../utils/shell')
  const result = await exec(command.command, command.args)

  if (result.success) {
    logger.success(`Created bucket: ${bucketName}`)
    return true
  }

  logger.error('Failed to create bucket')
  logger.dim(result.stderr || result.stdout)
  return false
}

export async function s3List(
  prefix: string | undefined,
  options: S3Options = {},
): Promise<boolean> {
  logger.title('S3 Objects')

  const config = loadS3Config(options)
  if (!config) return false

  const s3Path = prefix
    ? `s3://${config.bucket}/${prefix}`
    : `s3://${config.bucket}/`

  const awsArgs = buildAwsArgs(config, ['s3', 'ls', s3Path])
  const command = buildAwsCommand(awsArgs, options, config)
  const { exec } = await import('../utils/shell')
  const result = await exec(command.command, command.args)

  if (!result.success) {
    logger.error('Failed to list objects')
    logger.dim(result.stderr || result.stdout)
    return false
  }

  const lines = result.stdout.split('\n').filter((l) => l.trim())

  if (lines.length === 0) {
    logger.info('No objects found')
    logger.newline()
    logger.dim('  Upload a file: fnkit s3 upload <local-file> <s3-key>')
    logger.newline()
    return true
  }

  console.log('')
  for (const line of lines) {
    console.log(`   ${line.trim()}`)
  }
  console.log('')
  logger.info(`${lines.length} object${lines.length > 1 ? 's' : ''} found`)
  logger.newline()

  return true
}

export async function s3Upload(
  localFile: string | undefined,
  s3Key: string | undefined,
  options: S3Options = {},
): Promise<boolean> {
  if (!localFile) {
    logger.error('Usage: fnkit s3 upload <local-file> [s3-key]')
    return false
  }

  const filePath = resolve(process.cwd(), localFile)
  if (!existsSync(filePath)) {
    logger.error(`File not found: ${localFile}`)
    return false
  }

  // Default s3 key to the filename
  const key = s3Key || basename(localFile)

  const config = loadS3Config(options)
  if (!config) return false

  logger.step(`Uploading ${localFile} → s3://${config.bucket}/${key}`)

  const awsArgs = buildAwsArgs(config, [
    's3',
    'cp',
    filePath,
    `s3://${config.bucket}/${key}`,
  ])
  const command = buildAwsCommand(awsArgs, options, config)
  const { exec } = await import('../utils/shell')
  const result = await exec(command.command, command.args)

  if (result.success) {
    logger.success(`Uploaded: s3://${config.bucket}/${key}`)
    return true
  }

  logger.error('Failed to upload file')
  logger.dim(result.stderr || result.stdout)
  return false
}

export async function s3Download(
  s3Key: string | undefined,
  localFile: string | undefined,
  options: S3Options = {},
): Promise<boolean> {
  if (!s3Key) {
    logger.error('Usage: fnkit s3 download <s3-key> [local-file]')
    return false
  }

  const config = loadS3Config(options)
  if (!config) return false

  // Default local file to the s3 key basename
  const outputFile = localFile || basename(s3Key)
  const outputPath = resolve(process.cwd(), outputFile)

  logger.step(`Downloading s3://${config.bucket}/${s3Key} → ${outputFile}`)

  const awsArgs = buildAwsArgs(config, [
    's3',
    'cp',
    `s3://${config.bucket}/${s3Key}`,
    outputPath,
  ])
  const command = buildAwsCommand(awsArgs, options, config)
  const { exec } = await import('../utils/shell')
  const result = await exec(command.command, command.args)

  if (result.success) {
    logger.success(`Downloaded: ${outputFile}`)
    return true
  }

  logger.error('Failed to download file')
  logger.dim(result.stderr || result.stdout)
  return false
}

export async function s3Remove(
  s3Key: string | undefined,
  options: S3Options = {},
): Promise<boolean> {
  if (!s3Key) {
    logger.error('Usage: fnkit s3 rm <s3-key>')
    return false
  }

  const config = loadS3Config(options)
  if (!config) return false

  logger.step(`Deleting s3://${config.bucket}/${s3Key}`)

  const awsArgs = buildAwsArgs(config, [
    's3',
    'rm',
    `s3://${config.bucket}/${s3Key}`,
  ])
  const command = buildAwsCommand(awsArgs, options, config)
  const { exec } = await import('../utils/shell')
  const result = await exec(command.command, command.args)

  if (result.success) {
    logger.success(`Deleted: s3://${config.bucket}/${s3Key}`)
    return true
  }

  logger.error('Failed to delete file')
  logger.dim(result.stderr || result.stdout)
  return false
}

// ── Router ───────────────────────────────────────────────────────────

export async function s3(
  subcommand: string,
  positionalArgs: string[] = [],
  options: S3Options = {},
): Promise<boolean> {
  switch (subcommand) {
    case 'init':
      return s3Init(options)
    case 'mb':
    case 'create-bucket':
      return s3MakeBucket(positionalArgs[0], options)
    case 'ls':
    case 'list':
      return s3List(positionalArgs[0], options)
    case 'upload':
    case 'cp':
      return s3Upload(positionalArgs[0], positionalArgs[1], options)
    case 'download':
    case 'dl':
      return s3Download(positionalArgs[0], positionalArgs[1], options)
    case 'rm':
    case 'delete':
      return s3Remove(positionalArgs[0], options)
    default:
      logger.error(`Unknown s3 command: ${subcommand}`)
      logger.info('Available commands: init, mb, ls, upload, download, rm')
      logger.newline()
      logger.dim('  fnkit s3 init --bucket <bucket> --endpoint <url>   Save S3 config')
      logger.dim('  fnkit s3 mb <bucket-name>                          Create bucket')
      logger.dim('  fnkit s3 ls [prefix]                               List objects')
      logger.dim('  fnkit s3 upload <local-file> [s3-key]              Upload file')
      logger.dim('  fnkit s3 download <s3-key> [local-file]            Download file')
      logger.dim('  fnkit s3 rm <s3-key>                               Delete file')
      return false
  }
}

export default s3
