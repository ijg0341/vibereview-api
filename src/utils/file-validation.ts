import crypto from 'crypto'
import mimeTypes from 'mime-types'
import type { MultipartFile } from '@fastify/multipart'

export interface FileValidationOptions {
  maxSize: number
  allowedMimeTypes: string[]
  allowedExtensions?: string[]
}

export interface ValidatedFile {
  filename: string
  mimetype: string
  size: number
  hash: string
  buffer: Buffer
  extension: string
}

export class FileValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FileValidationError'
  }
}

export async function validateFile(
  file: MultipartFile,
  options: FileValidationOptions
): Promise<ValidatedFile> {
  // Read file buffer
  const buffer = await file.toBuffer()
  
  // Check file size
  if (buffer.length > options.maxSize) {
    throw new FileValidationError(
      `File too large. Maximum size is ${Math.round(options.maxSize / 1024 / 1024)}MB`
    )
  }
  
  if (buffer.length === 0) {
    throw new FileValidationError('File is empty')
  }
  
  // Validate MIME type
  if (!options.allowedMimeTypes.includes(file.mimetype)) {
    throw new FileValidationError(
      `Invalid file type. Allowed types: ${options.allowedMimeTypes.join(', ')}`
    )
  }
  
  // Get file extension
  const extension = getFileExtension(file.filename)
  if (!extension) {
    throw new FileValidationError('File must have an extension')
  }
  
  // Validate extension if specified
  if (options.allowedExtensions && !options.allowedExtensions.includes(extension)) {
    throw new FileValidationError(
      `Invalid file extension. Allowed extensions: ${options.allowedExtensions.join(', ')}`
    )
  }
  
  // Generate file hash for deduplication
  const hash = crypto.createHash('sha256').update(buffer).digest('hex')
  
  // Additional content validation based on MIME type
  await validateFileContent(buffer, file.mimetype, extension)
  
  return {
    filename: sanitizeFilename(file.filename),
    mimetype: file.mimetype,
    size: buffer.length,
    hash,
    buffer,
    extension,
  }
}

function getFileExtension(filename: string): string | null {
  const match = filename.match(/\.([^.]+)$/)
  return match ? match[1]!.toLowerCase() : null
}

function sanitizeFilename(filename: string): string {
  // Remove path traversal attempts and dangerous characters
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\.+/, '')
    .substring(0, 255) // Limit length
}

async function validateFileContent(
  buffer: Buffer,
  mimetype: string,
  extension: string
): Promise<void> {
  const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length))
  
  // Validate JSON files
  if (mimetype === 'application/json' || extension === 'json') {
    try {
      JSON.parse(buffer.toString('utf8'))
    } catch {
      throw new FileValidationError('Invalid JSON file')
    }
  }
  
  // Validate JSONL files
  if (mimetype === 'application/jsonl' || mimetype === 'application/x-jsonlines' || 
      extension === 'jsonl') {
    const lines = buffer.toString('utf8').split('\n').filter(line => line.trim())
    for (const line of lines.slice(0, 10)) { // Check first 10 lines
      try {
        JSON.parse(line)
      } catch {
        throw new FileValidationError('Invalid JSONL file: each line must be valid JSON')
      }
    }
  }
  
  // Check for potential malicious content
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload\s*=/gi,
    /onerror\s*=/gi,
  ]
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(content)) {
      throw new FileValidationError('File contains potentially malicious content')
    }
  }
}

export function generateStoragePath(
  teamId: string,
  userId: string,
  filename: string,
  hash: string
): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const hashPrefix = hash.substring(0, 8)
  const extension = getFileExtension(filename) || ''
  
  return `${teamId}/${userId}/${timestamp}_${hashPrefix}.${extension}`
}

export function parseToolName(filename: string): string | null {
  const lowerFilename = filename.toLowerCase()
  
  if (lowerFilename.includes('claude') || lowerFilename.includes('anthropic')) {
    return 'claude-code'
  }
  if (lowerFilename.includes('copilot') || lowerFilename.includes('github')) {
    return 'github-copilot'
  }
  if (lowerFilename.includes('codex') || lowerFilename.includes('openai')) {
    return 'openai-codex'
  }
  if (lowerFilename.includes('gemini') || lowerFilename.includes('google')) {
    return 'gemini-cli'
  }
  if (lowerFilename.includes('cursor')) {
    return 'cursor'
  }
  if (lowerFilename.includes('codewhisperer') || lowerFilename.includes('aws')) {
    return 'aws-codewhisperer'
  }
  
  return null
}