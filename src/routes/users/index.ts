import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getSupabase } from '../../utils/supabase.js'
import { z } from 'zod'

const updateProfileSchema = z.object({
  full_name: z.string().optional(),
  username: z.string().optional(),
  avatar_url: z.string().url().optional(),
})

const updateSettingsSchema = z.object({
  language: z.string().optional(),
  work_directory: z.string().optional(),
  notifications_enabled: z.boolean().optional(),
  timezone: z.string().optional(),
})

export default async function userRoutes(fastify: FastifyInstance) {
  // Apply authentication to all routes
  fastify.addHook('preHandler', authMiddleware)

  // GET /users/profile - 내 프로필 조회
  fastify.get('/profile', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const supabase = getSupabase()

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle() as { data: any; error: any }

      if (error) {
        request.log.error(error, 'Failed to fetch profile')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch profile'
        })
      }

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          profile: profile || {
            full_name: null,
            username: null,
            avatar_url: null,
            role: 'member',
            team_id: null,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        }
      })

    } catch (error) {
      request.log.error(error, 'Get profile error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // PUT /users/profile - 프로필 수정
  fastify.put('/profile', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const updates = updateProfileSchema.parse(request.body)
      const supabase = getSupabase()

      // Check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle() as { data: any }

      let result
      if (existingProfile) {
        // Update existing profile
        result = await (supabase as any)
          .from('profiles')
          .update({
            ...updates,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
          .select()
          .single()
      } else {
        // Create new profile
        result = await (supabase as any)
          .from('profiles')
          .insert({
            id: user.id,
            ...updates,
            role: 'member',
            is_active: true,
          })
          .select()
          .single()
      }

      const { data, error } = result

      if (error) {
        request.log.error(error, 'Failed to update profile')
        return reply.status(500).send({
          success: false,
          error: 'Failed to update profile'
        })
      }

      return reply.send({
        success: true,
        message: 'Profile updated successfully',
        data
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid input',
          details: error.issues
        })
      }

      request.log.error(error, 'Update profile error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // GET /users/settings - 사용자 설정 조회
  fastify.get('/settings', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const supabase = getSupabase()

      // For now, return default settings
      // TODO: Create user_settings table for custom settings
      const defaultSettings = {
        language: 'ko',
        work_directory: null,
        notifications_enabled: true,
        timezone: 'Asia/Seoul',
        theme: 'light',
        file_auto_detection: true,
      }

      return reply.send({
        success: true,
        data: defaultSettings
      })

    } catch (error) {
      request.log.error(error, 'Get settings error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // PUT /users/settings - 사용자 설정 변경
  fastify.put('/settings', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const settings = updateSettingsSchema.parse(request.body)

      // TODO: Implement actual settings storage
      // For now, just return success
      return reply.send({
        success: true,
        message: 'Settings updated successfully',
        data: settings
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid input',
          details: error.issues
        })
      }

      request.log.error(error, 'Update settings error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })
}