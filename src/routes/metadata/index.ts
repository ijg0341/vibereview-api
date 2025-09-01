import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware, requireTeam, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getSupabase } from '../../utils/supabase.js'
import { z } from 'zod'

const listFilesSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  tool_name: z.string().optional(),
  status: z.enum(['uploaded', 'processing', 'processed', 'failed']).optional(),
  search: z.string().optional(),
  sort: z.enum(['created_at', 'file_size', 'original_filename']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export default async function metadataRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware to all routes
  fastify.addHook('preHandler', authMiddleware)
  fastify.addHook('preHandler', requireTeam())

  // List uploaded files
  fastify.get('/files', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const query = listFilesSchema.parse(request.query)
      const supabase = getSupabase()

      // Build query
      let dbQuery = supabase
        .from('uploaded_files')
        .select(`
          id,
          original_filename,
          file_size,
          mime_type,
          tool_name,
          session_date,
          upload_status,
          processing_error,
          metadata,
          created_at,
          updated_at
        `, { count: 'exact' })
        .eq('team_id', user.team_id!)

      // Apply filters
      if (query.tool_name) {
        dbQuery = dbQuery.eq('tool_name', query.tool_name)
      }

      if (query.status) {
        dbQuery = dbQuery.eq('upload_status', query.status)
      }

      if (query.search) {
        dbQuery = dbQuery.ilike('original_filename', `%${query.search}%`)
      }

      // Apply sorting
      dbQuery = dbQuery.order(query.sort, { ascending: query.order === 'asc' })

      // Apply pagination
      const offset = (query.page - 1) * query.limit
      dbQuery = dbQuery.range(offset, offset + query.limit - 1)

      const { data, error, count } = await dbQuery

      if (error) {
        request.log.error(error, 'Failed to fetch files')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch files'
        })
      }

      const totalPages = Math.ceil((count || 0) / query.limit)

      return reply.send({
        success: true,
        data: {
          files: data || [],
          pagination: {
            page: query.page,
            limit: query.limit,
            total: count || 0,
            total_pages: totalPages,
            has_next: query.page < totalPages,
            has_prev: query.page > 1,
          }
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid query parameters',
          details: error.issues
        })
      }

      request.log.error(error, 'List files error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // Get file details
  fastify.get('/files/:fileId', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { fileId } = request.params as { fileId: string }
      const supabase = getSupabase()

      const { data, error } = await supabase
        .from('uploaded_files')
        .select('*')
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
      request.log.error(error, 'Get file details error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // Delete file
  fastify.delete('/files/:fileId', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { fileId } = request.params as { fileId: string }
      const supabase = getSupabase()

      // Get file info first
      const { data: fileData, error: fetchError } = await supabase
        .from('uploaded_files')
        .select('storage_path, original_filename')
        .eq('id', fileId)
        .eq('team_id', user.team_id!)
        .eq('user_id', user.id) // Users can only delete their own files
        .single()

      if (fetchError || !fileData) {
        return reply.status(404).send({
          success: false,
          error: 'File not found or not authorized'
        })
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('session-files')
        .remove([fileData.storage_path])

      if (storageError) {
        request.log.error(storageError, 'Failed to delete file from storage')
      }

      // Delete from database
      const { error: dbError } = await supabase
        .from('uploaded_files')
        .delete()
        .eq('id', fileId)

      if (dbError) {
        request.log.error(dbError, 'Failed to delete file from database')
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete file'
        })
      }

      return reply.send({
        success: true,
        message: `File "${fileData.original_filename}" deleted successfully`
      })

    } catch (error) {
      request.log.error(error, 'Delete file error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // Get team statistics
  fastify.get('/stats', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const supabase = getSupabase()

      // Get file counts and sizes
      const { data: stats, error } = await supabase
        .from('uploaded_files')
        .select('upload_status, tool_name, file_size')
        .eq('team_id', user.team_id!)

      if (error) {
        request.log.error(error, 'Failed to fetch stats')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch statistics'
        })
      }

      // Calculate statistics
      const totalFiles = stats.length
      const totalSize = stats.reduce((sum, file) => sum + file.file_size, 0)
      
      const statusCounts = stats.reduce((acc, file) => {
        acc[file.upload_status] = (acc[file.upload_status] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const toolCounts = stats.reduce((acc, file) => {
        if (file.tool_name) {
          acc[file.tool_name] = (acc[file.tool_name] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)

      return reply.send({
        success: true,
        data: {
          total_files: totalFiles,
          total_size: totalSize,
          status_counts: statusCounts,
          tool_counts: toolCounts,
          average_file_size: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0,
        }
      })

    } catch (error) {
      request.log.error(error, 'Get stats error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // Download file content
  fastify.get('/files/:fileId/download', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { fileId } = request.params as { fileId: string }
      const supabase = getSupabase()

      // Get file info
      const { data: fileData, error: fetchError } = await supabase
        .from('uploaded_files')
        .select('storage_path, original_filename, mime_type')
        .eq('id', fileId)
        .eq('team_id', user.team_id!)
        .single()

      if (fetchError || !fileData) {
        return reply.status(404).send({
          success: false,
          error: 'File not found'
        })
      }

      // Get file from storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from('session-files')
        .download(fileData.storage_path)

      if (storageError || !storageData) {
        request.log.error(storageError, 'Failed to download file from storage')
        return reply.status(500).send({
          success: false,
          error: 'Failed to download file'
        })
      }

      // Convert Blob to Buffer
      const arrayBuffer = await storageData.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Set headers for file download
      reply.header('Content-Type', fileData.mime_type)
      reply.header('Content-Disposition', `attachment; filename="${fileData.original_filename}"`)
      reply.header('Content-Length', buffer.length)

      return reply.send(buffer)

    } catch (error) {
      request.log.error(error, 'Download file error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })
}