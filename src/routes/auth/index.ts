import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getSupabase } from '../../utils/supabase.js'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  full_name: z.string().optional(),
})

export default async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/login - 이메일/비밀번호 로그인
  fastify.post('/login', {
    schema: {
      tags: ['Auth'],
      summary: '사용자 로그인',
      description: '이메일과 비밀번호로 로그인하여 JWT 토큰을 받습니다',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: '사용자 이메일' },
          password: { type: 'string', minLength: 6, description: '비밀번호 (최소 6자)' }
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
                user: { type: 'object', description: '사용자 정보' },
                session: { type: 'object', description: '세션 정보' },
                access_token: { type: 'string', description: 'JWT 액세스 토큰' },
                refresh_token: { type: 'string', description: '리프레시 토큰' }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const { email, password } = loginSchema.parse(request.body)
      const supabase = getSupabase()

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid credentials',
          details: error.message
        })
      }

      return reply.send({
        success: true,
        data: {
          user: data.user,
          session: data.session,
          access_token: data.session?.access_token,
          refresh_token: data.session?.refresh_token,
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

      request.log.error(error, 'Login error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // POST /auth/signup - 신규 사용자 가입
  fastify.post('/signup', {
    schema: {
      tags: ['Auth'],
      summary: '신규 사용자 가입',
      description: '새 계정을 생성합니다. 이메일 인증이 필요할 수 있습니다',
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', description: '사용자 이메일' },
          password: { type: 'string', minLength: 6, description: '비밀번호 (최소 6자)' },
          full_name: { type: 'string', description: '사용자 이름 (선택사항)' }
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
                user: { type: 'object', description: '생성된 사용자 정보' },
                session: { type: 'object', description: '세션 정보' }
              }
            }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const { email, password, full_name } = signupSchema.parse(request.body)
      const supabase = getSupabase()

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: full_name || null,
          }
        }
      })

      if (error) {
        return reply.status(400).send({
          success: false,
          error: 'Signup failed',
          details: error.message
        })
      }

      return reply.status(201).send({
        success: true,
        message: 'User created successfully. Please check your email for verification.',
        data: {
          user: data.user,
          session: data.session,
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

      request.log.error(error, 'Signup error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // POST /auth/logout - 로그아웃
  fastify.post('/logout', {
    schema: {
      tags: ['Auth'],
      summary: '사용자 로그아웃',
      description: 'JWT 토큰을 무효화하여 로그아웃합니다',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string', description: '로그아웃 완료 메시지' }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const authHeader = request.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: 'Missing authorization header'
        })
      }

      const token = authHeader.replace('Bearer ', '')
      const supabase = getSupabase()

      const { error } = await supabase.auth.admin.signOut(token)

      if (error) {
        request.log.error(error, 'Logout error')
      }

      return reply.send({
        success: true,
        message: 'Logged out successfully'
      })

    } catch (error) {
      request.log.error(error, 'Logout error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // GET /auth/session - 현재 세션 확인
  fastify.get('/session', {
    schema: {
      tags: ['Auth'],
      summary: '현재 세션 확인',
      description: 'JWT 토큰으로 현재 로그인 상태와 사용자 정보를 확인합니다',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', description: '사용자 ID' },
                    email: { type: 'string', description: '이메일' },
                    created_at: { type: 'string', description: '가입일' },
                    profile: { type: 'object', description: '프로필 정보' }
                  }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const authHeader = request.headers.authorization
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({
          success: false,
          error: 'Missing authorization header'
        })
      }

      const token = authHeader.replace('Bearer ', '')
      const supabase = getSupabase()

      const { data: { user }, error } = await supabase.auth.getUser(token)
      if (error || !user) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid or expired token'
        })
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle() as { data: any }

      return reply.send({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            email_confirmed_at: user.email_confirmed_at,
            profile: profile || null
          }
        }
      })

    } catch (error) {
      request.log.error(error, 'Session check error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // POST /auth/callback - OAuth 콜백 (placeholder)
  fastify.post('/callback', {
    schema: {
      tags: ['Auth'],
      summary: 'OAuth 콜백 처리',
      description: '소셜 로그인 OAuth 리다이렉트를 처리합니다 (미구현)',
      response: {
        501: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string', description: '미구현 메시지' }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    return reply.status(501).send({
      success: false,
      error: 'OAuth callback not implemented yet'
    })
  })
}