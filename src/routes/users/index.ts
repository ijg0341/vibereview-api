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
  fastify.get('/profile', {
    schema: {
      tags: ['Users'],
      summary: '내 프로필 조회',
      description: '현재 로그인한 사용자의 프로필 정보를 조회합니다',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '사용자 ID' },
                email: { type: 'string', description: '이메일' },
                profile: {
                  type: 'object',
                  properties: {
                    full_name: { type: 'string', description: '이름' },
                    username: { type: 'string', description: '사용자명' },
                    avatar_url: { type: 'string', description: '프로필 이미지 URL' },
                    role: { type: 'string', enum: ['admin', 'member'], description: '역할' },
                    team_id: { type: 'string', description: '팀 ID' }
                  }
                }
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
  fastify.put('/profile', {
    schema: {
      tags: ['Users'],
      summary: '프로필 수정',
      description: '사용자 프로필 정보를 수정합니다',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          full_name: { type: 'string', description: '이름' },
          username: { type: 'string', description: '사용자명' },
          avatar_url: { type: 'string', format: 'uri', description: '프로필 이미지 URL' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', description: '업데이트된 프로필 정보' }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
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
  fastify.get('/settings', {
    schema: {
      tags: ['Users'],
      summary: '사용자 설정 조회',
      description: '사용자의 개인 설정을 조회합니다',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                language: { type: 'string', description: '언어 설정' },
                work_directory: { type: 'string', description: '작업 디렉토리' },
                notifications_enabled: { type: 'boolean', description: '알림 설정' },
                timezone: { type: 'string', description: '시간대' },
                theme: { type: 'string', description: '테마 설정' },
                file_auto_detection: { type: 'boolean', description: '파일 자동 감지' }
              }
            }
          }
        }
      }
    }
  }, async function (_request: FastifyRequest, reply) {
    try {
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
      _request.log.error(error, 'Get settings error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // PUT /users/settings - 사용자 설정 변경
  fastify.put('/settings', {
    schema: {
      tags: ['Users'],
      summary: '사용자 설정 변경',
      description: '사용자의 개인 설정을 변경합니다',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          language: { type: 'string', description: '언어 설정 (ko, en)' },
          work_directory: { type: 'string', description: '작업 디렉토리 경로' },
          notifications_enabled: { type: 'boolean', description: '알림 활성화' },
          timezone: { type: 'string', description: '시간대 (예: Asia/Seoul)' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', description: '업데이트된 설정' }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
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