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
  fastify.post('/login', async function (request: FastifyRequest, reply) {
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
  fastify.post('/signup', async function (request: FastifyRequest, reply) {
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
  fastify.post('/logout', async function (request: FastifyRequest, reply) {
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
  fastify.get('/session', async function (request: FastifyRequest, reply) {
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
  fastify.post('/callback', async function (request: FastifyRequest, reply) {
    return reply.status(501).send({
      success: false,
      error: 'OAuth callback not implemented yet'
    })
  })
}