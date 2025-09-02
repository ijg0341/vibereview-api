import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware, requireTeam, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getSupabase } from '../../utils/supabase.js'
import { generateApiKey, verifyApiKey, isValidApiKeyFormat } from '../../utils/api-keys.js'
import { z } from 'zod'

const createApiKeySchema = z.object({
  name: z.string().min(1).max(100),
  expires_days: z.number().min(1).max(365).optional(),
})

const updateApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
})

const verifyApiKeySchema = z.object({
  api_key: z.string().refine(isValidApiKeyFormat, 'Invalid API key format'),
})

export default async function apiKeyRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware (except for verify endpoint)
  fastify.addHook('preHandler', async (request, reply) => {
    // Skip auth for verify endpoint
    if (request.url === '/verify' && request.method === 'POST') {
      return
    }
    await authMiddleware(request, reply)
    if (reply.sent) return
    await requireTeam()(request, reply)
  })

  // GET /api-keys - API 키 목록 조회
  fastify.get('/', {
    schema: {
      tags: ['API Keys'],
      summary: 'API 키 목록 조회',
      description: '내가 생성한 API 키 목록을 조회합니다. 실제 키 값은 표시되지 않습니다',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'API 키 ID' },
                  name: { type: 'string', description: 'API 키 이름' },
                  key_preview: { type: 'string', description: '키 미리보기 (vr_****...xxxx)' },
                  is_active: { type: 'boolean', description: '활성화 상태' },
                  last_used_at: { type: 'string', description: '마지막 사용 일시' },
                  expires_at: { type: 'string', description: '만료일' },
                  created_at: { type: 'string', description: '생성일' }
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

      const { data: apiKeys, error } = await supabase
        .from('api_keys')
        .select('id, name, key_preview, is_active, last_used_at, expires_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }) as { data: any; error: any }

      if (error) {
        request.log.error(error, 'Failed to fetch API keys')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch API keys'
        })
      }

      return reply.send({
        success: true,
        data: apiKeys || []
      })

    } catch (error) {
      request.log.error(error, 'Get API keys error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // POST /api-keys - 새 API 키 생성
  fastify.post('/', {
    schema: {
      tags: ['API Keys'],
      summary: '새 API 키 생성',
      description: 'CLI나 외부 도구에서 사용할 새 API 키를 생성합니다. 키는 생성 시 한 번만 표시됩니다',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { 
            type: 'string', 
            minLength: 1, 
            maxLength: 100,
            description: 'API 키 이름 (예: "CLI Upload Key")' 
          },
          expires_days: { 
            type: 'number', 
            minimum: 1, 
            maximum: 365,
            description: '만료일 (일수, 선택사항)' 
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
                id: { type: 'string' },
                name: { type: 'string' },
                api_key: { 
                  type: 'string', 
                  description: '⚠️ 실제 API 키 (한 번만 표시됨, 안전한 곳에 저장하세요)'
                },
                key_preview: { type: 'string' },
                expires_at: { type: 'string' },
                created_at: { type: 'string' }
              }
            }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { name, expires_days } = createApiKeySchema.parse(request.body)
      const supabase = getSupabase()

      // API 키 생성
      const { key, hash, preview } = generateApiKey()

      // 만료일 계산
      const expiresAt = expires_days 
        ? new Date(Date.now() + expires_days * 24 * 60 * 60 * 1000).toISOString()
        : null

      // 데이터베이스에 저장
      const { data: apiKeyData, error } = await (supabase as any)
        .from('api_keys')
        .insert({
          user_id: user.id,
          team_id: user.team_id!,
          name,
          key_hash: hash,
          key_preview: preview,
          expires_at: expiresAt,
        })
        .select()
        .single()

      if (error) {
        request.log.error(error, 'Failed to create API key')
        return reply.status(500).send({
          success: false,
          error: 'Failed to create API key'
        })
      }

      return reply.status(201).send({
        success: true,
        message: 'API key created successfully. Please save it safely - it will not be shown again.',
        data: {
          id: apiKeyData.id,
          name: apiKeyData.name,
          api_key: key, // 실제 키는 한 번만 표시
          key_preview: preview,
          expires_at: expiresAt,
          created_at: apiKeyData.created_at,
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid input',
          details: error.issues
        })
      }

      request.log.error(error, 'Create API key error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // PUT /api-keys/{id} - API 키 수정
  fastify.put('/:keyId', {
    schema: {
      tags: ['API Keys'],
      summary: 'API 키 수정',
      description: 'API 키의 이름이나 활성화 상태를 변경합니다',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          keyId: { type: 'string', description: 'API 키 ID' }
        },
        required: ['keyId']
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100, description: '새 이름' },
          is_active: { type: 'boolean', description: '활성화 상태' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object', description: '업데이트된 API 키 정보' }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { keyId } = request.params as { keyId: string }
      const updates = updateApiKeySchema.parse(request.body)
      const supabase = getSupabase()

      const { data, error } = await (supabase as any)
        .from('api_keys')
        .update(updates)
        .eq('id', keyId)
        .eq('user_id', user.id)
        .select('id, name, key_preview, is_active, expires_at, updated_at')
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return reply.status(404).send({
            success: false,
            error: 'API key not found'
          })
        }
        
        request.log.error(error, 'Failed to update API key')
        return reply.status(500).send({
          success: false,
          error: 'Failed to update API key'
        })
      }

      return reply.send({
        success: true,
        message: 'API key updated successfully',
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

      request.log.error(error, 'Update API key error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // DELETE /api-keys/{id} - API 키 삭제
  fastify.delete('/:keyId', {
    schema: {
      tags: ['API Keys'],
      summary: 'API 키 삭제',
      description: 'API 키를 완전히 삭제합니다. 삭제 후 해당 키로는 더 이상 접근할 수 없습니다',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          keyId: { type: 'string', description: 'API 키 ID' }
        },
        required: ['keyId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { keyId } = request.params as { keyId: string }
      const supabase = getSupabase()

      // 먼저 API 키 정보 조회
      const { data: apiKey, error: fetchError } = await supabase
        .from('api_keys')
        .select('name')
        .eq('id', keyId)
        .eq('user_id', user.id)
        .maybeSingle() as { data: any; error: any }

      if (fetchError || !apiKey) {
        return reply.status(404).send({
          success: false,
          error: 'API key not found'
        })
      }

      // API 키 삭제
      const { error: deleteError } = await supabase
        .from('api_keys')
        .delete()
        .eq('id', keyId)
        .eq('user_id', user.id)

      if (deleteError) {
        request.log.error(deleteError, 'Failed to delete API key')
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete API key'
        })
      }

      return reply.send({
        success: true,
        message: `API key "${apiKey.name}" deleted successfully`
      })

    } catch (error) {
      request.log.error(error, 'Delete API key error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // POST /api-keys/verify - CLI용 API 키 검증
  fastify.post('/verify', {
    schema: {
      tags: ['API Keys'],
      summary: 'API 키 검증',
      description: 'CLI나 외부 도구에서 API 키의 유효성을 검증합니다. 인증 토큰 없이 호출 가능합니다',
      body: {
        type: 'object',
        required: ['api_key'],
        properties: {
          api_key: { 
            type: 'string', 
            pattern: '^vr_[A-Za-z0-9_-]{28}$',
            description: 'API 키 (vr_로 시작하는 31자리)' 
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                valid: { type: 'boolean', description: '키 유효성' },
                user_id: { type: 'string', description: '키 소유자 ID' },
                team_id: { type: 'string', description: '팀 ID' },
                name: { type: 'string', description: '키 이름' },
                expires_at: { type: 'string', description: '만료일' }
              }
            }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const { api_key } = verifyApiKeySchema.parse(request.body)
      const supabase = getSupabase()

      // API 키 조회
      const { data: apiKeys, error } = await supabase
        .from('api_keys')
        .select('id, user_id, team_id, name, key_hash, is_active, expires_at')
        .eq('is_active', true) as { data: any; error: any }

      if (error) {
        request.log.error(error, 'Failed to fetch API keys for verification')
        return reply.status(500).send({
          success: false,
          error: 'Failed to verify API key'
        })
      }

      // 해시 검증
      const matchingKey = apiKeys?.find((key: any) => verifyApiKey(api_key, key.key_hash))

      if (!matchingKey) {
        return reply.send({
          success: true,
          data: {
            valid: false,
            message: 'Invalid or inactive API key'
          }
        })
      }

      // 만료일 확인
      const now = new Date()
      if (matchingKey.expires_at && new Date(matchingKey.expires_at) < now) {
        return reply.send({
          success: true,
          data: {
            valid: false,
            message: 'API key has expired'
          }
        })
      }

      // 마지막 사용 시간 업데이트
      await (supabase as any)
        .from('api_keys')
        .update({ last_used_at: now.toISOString() })
        .eq('id', matchingKey.id)

      return reply.send({
        success: true,
        data: {
          valid: true,
          user_id: matchingKey.user_id,
          team_id: matchingKey.team_id,
          name: matchingKey.name,
          expires_at: matchingKey.expires_at
        }
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid input',
          details: error.issues
        })
      }

      request.log.error(error, 'Verify API key error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })
}