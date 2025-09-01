import { z } from 'zod'

// File upload schemas
export const uploadFileSchema = z.object({
  filename: z.string(),
  mimetype: z.string(),
  encoding: z.string(),
})

export const uploadMetadataSchema = z.object({
  tool_name: z.string().optional(),
  session_date: z.string().date().optional(),
  metadata: z.record(z.any()).optional(),
})

// Response schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.any().optional(),
  error: z.string().optional(),
})

export const uploadResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  data: z.object({
    file_id: z.string().uuid(),
    filename: z.string(),
    size: z.number(),
    storage_path: z.string(),
    upload_status: z.enum(['uploaded', 'processing', 'processed', 'failed']),
  }).optional(),
  error: z.string().optional(),
})

// Database types
export interface UploadedFile {
  id: string
  team_id: string
  user_id: string
  original_filename: string
  storage_path: string
  file_size: number
  mime_type: string
  file_hash?: string
  tool_name?: string
  session_date?: string
  upload_status: 'uploaded' | 'processing' | 'processed' | 'failed'
  processing_error?: string
  metadata?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export interface Profile {
  id: string
  team_id?: string
  full_name?: string
  username?: string
  avatar_url?: string
  role: 'admin' | 'member'
  created_at: string
  updated_at: string
}

// Type inference helpers
export type UploadFileInput = z.infer<typeof uploadFileSchema>
export type UploadMetadata = z.infer<typeof uploadMetadataSchema>
export type ApiResponse<T = any> = z.infer<typeof apiResponseSchema> & { data?: T }
export type UploadResponse = z.infer<typeof uploadResponseSchema>