import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware, requireTeam, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getSupabase } from '../../utils/supabase.js'
import { 
  validateFile, 
  generateStoragePath, 
  parseToolName, 
  FileValidationError 
} from '../../utils/file-validation.js'
import { uploadMetadataSchema } from '../../types/api.js'
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
  fastify.post('/file', async function (request: FastifyRequest, reply) {
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
      const formData = {
        tool_name: fields.tool_name?.value as string,
        session_date: fields.session_date?.value as string,
        metadata: fields.metadata?.value as string,
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
        .single()

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
        const { data: storageData, error: storageError } = await supabase.storage
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
        const { data: updateData, error: dbError } = await supabase
          .from('uploaded_files')
          .update({
            original_filename: validatedFile.filename,
            user_id: user.id, // Update uploader
            tool_name: toolName,
            session_date: parsedFields.session_date,
            upload_status: 'uploaded',
            metadata: parsedFields.metadata,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingFile.id)
          .select()
          .single()

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
        const { data: insertData, error: dbError } = await supabase
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
            upload_status: 'uploaded',
            metadata: parsedFields.metadata,
          })
          .select()
          .single()

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
  fastify.post('/batch', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
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
  fastify.get('/status/:fileId', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { fileId } = request.params as { fileId: string }
      const supabase = getSupabase()

      const { data, error } = await supabase
        .from('uploaded_files')
        .select('id, original_filename, upload_status, processing_error, created_at')
        .eq('id', fileId)
        .eq('team_id', user.team_id!)
        .single()

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