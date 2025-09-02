import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware, requireTeam, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getSupabase } from '../../utils/supabase.js'
import { 
  validateFile, 
  generateStoragePath, 
  parseToolName, 
  FileValidationError 
} from '../../utils/file-validation.js'
import { z } from 'zod'

const uploadRequestSchema = z.object({
  tool_name: z.string().optional(),
  session_date: z.string().optional(),
  metadata: z.string().optional().transform((val) => {
    if (!val) return undefined
    try {
      return JSON.parse(val)
    } catch {
      throw new Error('metadata must be valid JSON string')
    }
  }),
})

export default async function uploadRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('preHandler', authMiddleware)
  fastify.addHook('preHandler', requireTeam())

  // Upload single file
  fastify.post('/file', {
    schema: {
      tags: ['Upload'],
      summary: '단일 파일 업로드',
      description: 'AI 도구 세션 파일을 업로드합니다. 중복 파일은 메타데이터만 업데이트됩니다',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      body: {
        type: 'object',
        properties: {
          file: { 
            type: 'string', 
            format: 'binary',
            description: '업로드할 세션 파일 (.json, .jsonl, .csv, .txt)'
          },
          tool_name: { 
            type: 'string', 
            description: 'AI 도구 이름 (선택사항, 자동 감지됨)' 
          },
          session_date: { 
            type: 'string', 
            format: 'date',
            description: '세션 날짜 (선택사항)' 
          },
          metadata: { 
            type: 'string', 
            description: '추가 메타데이터 (JSON 문자열)' 
          }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: {
              type: 'object',
              properties: {
                file_id: { type: 'string', description: '파일 ID' },
                filename: { type: 'string', description: '파일명' },
                size: { type: 'number', description: '파일 크기 (bytes)' },
                upload_status: { type: 'string', description: '업로드 상태' },
                tool_name: { type: 'string', description: '감지된 AI 도구명' },
                is_duplicate: { type: 'boolean', description: '중복 파일 여부' }
              }
            }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const supabase = getSupabase()

      // Get multipart data
      const data = await request.file()
      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file provided'
        })
      }

      // Parse additional fields from form data
      const fields = data.fields
      const getFieldValue = (field: any) => {
        if (!field) return undefined
        return typeof field === 'object' && 'value' in field ? field.value : field
      }
      
      const formData = {
        tool_name: getFieldValue(fields.tool_name) as string,
        session_date: getFieldValue(fields.session_date) as string,
        metadata: getFieldValue(fields.metadata) as string,
      }

      // Validate form data
      const parsedFields = uploadRequestSchema.parse(formData)

      // Validate file
      const allowedMimeTypes = process.env.ALLOWED_MIME_TYPES?.split(',') || [
        'application/json',
        'application/jsonl',
        'text/plain',
        'text/csv',
        'application/x-jsonlines'
      ]

      const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '52428800')

      const validatedFile = await validateFile(data, {
        maxSize: maxFileSize,
        allowedMimeTypes,
      })

      // Check for duplicate file (same hash)
      const { data: existingFile } = await supabase
        .from('uploaded_files')
        .select('id, original_filename, storage_path, upload_status')
        .eq('team_id', user.team_id!)
        .eq('file_hash', validatedFile.hash)
        .maybeSingle() as { data: any }

      let storagePath: string
      let shouldUploadToStorage = true

      if (existingFile) {
        // File already exists - upsert behavior
        storagePath = existingFile.storage_path
        shouldUploadToStorage = false
        
        request.log.info(`Duplicate file detected: ${existingFile.original_filename}, updating metadata only`)
      } else {
        // New file - generate new storage path
        storagePath = generateStoragePath(
          user.team_id!,
          user.id,
          validatedFile.filename,
          validatedFile.hash
        )
      }

      // Upload to Supabase Storage (only if not duplicate)
      if (shouldUploadToStorage) {
        const { error: storageError } = await supabase.storage
          .from('session-files')
          .upload(storagePath, validatedFile.buffer, {
            contentType: validatedFile.mimetype,
            duplex: 'half'
          })

        if (storageError) {
          request.log.error(storageError, 'Failed to upload file to storage')
          return reply.status(500).send({
            success: false,
            error: 'Failed to upload file to storage'
          })
        }
      }

      // Determine tool name
      const toolName = parsedFields.tool_name || parseToolName(validatedFile.filename)

      let dbData
      let isUpdate = false

      if (existingFile) {
        // Update existing file metadata (upsert behavior)
        const { data: updateData, error: dbError } = await (supabase as any)
          .from('uploaded_files')
          .update({
            original_filename: validatedFile.filename,
            user_id: user.id, // Update uploader
            tool_name: toolName,
            session_date: parsedFields.session_date,
            upload_status: 'uploaded' as const,
            metadata: parsedFields.metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFile.id)
          .select()
          .single() as { data: any; error: any }

        if (dbError) {
          request.log.error(dbError, 'Failed to update file metadata')
          return reply.status(500).send({
            success: false,
            error: 'Failed to update file metadata'
          })
        }

        dbData = updateData
        isUpdate = true

      } else {
        // Insert new file metadata
        const { data: insertData, error: dbError } = await (supabase as any)
          .from('uploaded_files')
          .insert({
            team_id: user.team_id!,
            user_id: user.id,
            original_filename: validatedFile.filename,
            storage_path: storagePath,
            file_size: validatedFile.size,
            mime_type: validatedFile.mimetype,
            file_hash: validatedFile.hash,
            tool_name: toolName,
            session_date: parsedFields.session_date,
            upload_status: 'uploaded' as const,
            metadata: parsedFields.metadata,
          })
          .select()
          .single() as { data: any; error: any }

        if (dbError) {
          request.log.error(dbError, 'Failed to save file metadata')
          
          // Clean up uploaded file (only if we actually uploaded it)
          if (shouldUploadToStorage) {
            await supabase.storage
              .from('session-files')
              .remove([storagePath])
          }

          return reply.status(500).send({
            success: false,
            error: 'Failed to save file metadata'
          })
        }

        dbData = insertData
      }

      // Normalization will be triggered automatically by database trigger

      // Return success response
      const statusCode = isUpdate ? 200 : 201
      const message = isUpdate 
        ? 'File metadata updated successfully (duplicate file detected)'
        : 'File uploaded successfully'

      return reply.status(statusCode).send({
        success: true,
        message,
        data: {
          file_id: dbData.id,
          filename: dbData.original_filename,
          size: dbData.file_size,
          storage_path: dbData.storage_path,
          upload_status: dbData.upload_status,
          tool_name: dbData.tool_name,
          session_date: dbData.session_date,
          is_duplicate: isUpdate,
        }
      })

    } catch (error) {
      if (error instanceof FileValidationError) {
        return reply.status(400).send({
          success: false,
          error: error.message
        })
      }

      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid request data',
          details: error.issues
        })
      }

      request.log.error(error, 'File upload error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error during file upload'
      })
    }
  })

  // Batch upload endpoint (for multiple files)
  fastify.post('/batch', {
    schema: {
      tags: ['Upload'],
      summary: '배치 파일 업로드',
      description: '여러 파일을 한 번에 업로드합니다 (현재 구현 중)',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        501: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string', description: '구현 예정 메시지' }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const files = request.files()
      const results = []
      const errors = []

      for await (const file of files) {
        try {
          // Process each file similar to single upload
          // This is a simplified version - you might want to extract the logic into a separate function
          
          const allowedMimeTypes = process.env.ALLOWED_MIME_TYPES?.split(',') || [
            'application/json',
            'application/jsonl',
            'text/plain',
            'text/csv',
            'application/x-jsonlines'
          ]

          const maxFileSize = parseInt(process.env.MAX_FILE_SIZE || '52428800')
          const validatedFile = await validateFile(file, {
            maxSize: maxFileSize,
            allowedMimeTypes,
          })

          results.push({
            filename: validatedFile.filename,
            size: validatedFile.size,
            status: 'pending'
          })
        } catch (error) {
          errors.push({
            filename: file.filename,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      return reply.send({
        success: true,
        message: `Processed ${results.length} files`,
        data: { results, errors }
      })

    } catch (error) {
      request.log.error(error, 'Batch upload error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error during batch upload'
      })
    }
  })

  // Get upload status
  fastify.get('/status/:fileId', {
    schema: {
      tags: ['Upload'],
      summary: '업로드 상태 확인',
      description: '파일 업로드 및 처리 상태를 확인합니다',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          fileId: { type: 'string', description: '파일 ID (UUID)' }
        },
        required: ['fileId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '파일 ID' },
                original_filename: { type: 'string', description: '파일명' },
                upload_status: { 
                  type: 'string', 
                  enum: ['uploaded', 'processing', 'processed', 'failed'],
                  description: '업로드 상태' 
                },
                processing_error: { type: 'string', description: '처리 에러 (있는 경우)' },
                created_at: { type: 'string', description: '업로드 일시' }
              }
            }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { fileId } = request.params as { fileId: string }
      const supabase = getSupabase()

      const { data, error } = await supabase
        .from('uploaded_files')
        .select('id, original_filename, upload_status, processing_error, created_at')
        .eq('id', fileId)
        .eq('team_id', user.team_id!)
        .maybeSingle() as { data: any; error: any }

      if (error || !data) {
        return reply.status(404).send({
          success: false,
          error: 'File not found'
        })
      }

      return reply.send({
        success: true,
        data
      })

    } catch (error) {
      request.log.error(error, 'Get upload status error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })
}