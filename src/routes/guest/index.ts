import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getSupabase } from '../../utils/supabase.js'
import { z } from 'zod'

const registerSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
})

interface GuestRegisterBody {
  email: string
  full_name: string
}

interface GuestInfoParams {
  email: string
}

interface GuestUserDB {
  id: string
  email: string
  full_name: string
  upload_count?: number
  total_file_size?: number
  last_upload_at?: string
  created_at?: string
}

interface SessionDB {
  session_id: string
  start_timestamp?: string
  end_timestamp?: string
  total_messages?: number
  total_tokens?: number
  prompt_count?: number
  project_name?: string
}

interface FileDB {
  id: string
  original_filename: string
  tool_name: string
  file_size: number
  upload_status: string
  created_at: string
}

interface SessionMessageDB {
  message_type: string
  content: string
  timestamp: string
  message_uuid: string
  sequence: number
  is_sidechain?: boolean
  subagent_name?: string
  subagent_type?: string
}

export default async function guestRoutes(fastify: FastifyInstance) {
  // POST /guest/register-or-get - 게스트 등록 또는 조회
  fastify.post('/register-or-get', {
    schema: {
      tags: ['Guest'],
      summary: '게스트 사용자 등록 또는 조회',
      description: '이메일로 게스트 사용자를 조회하고, 없으면 새로 생성합니다 (해커톤/행사용)',
      body: {
        type: 'object',
        required: ['email', 'full_name'],
        properties: {
          email: { type: 'string', format: 'email', description: '게스트 이메일 (고유 식별자)' },
          full_name: { type: 'string', description: '게스트 이름' }
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
                guest_user_id: { type: 'string', format: 'uuid', description: '게스트 사용자 ID' },
                email: { type: 'string', format: 'email', description: '이메일' },
                full_name: { type: 'string', description: '이름' },
                is_new: { type: 'boolean', description: '신규 생성 여부' }
              }
            }
          }
        },
        400: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async function (request: FastifyRequest<{ Body: GuestRegisterBody }>, reply) {
    try {
      const { email, full_name } = registerSchema.parse(request.body)
      const supabase = getSupabase()

      // 1. 이메일로 기존 게스트 조회
      const { data: existingGuest, error: selectError } = await supabase
        .from('guest_users')
        .select('id, email, full_name')
        .eq('email', email)
        .maybeSingle() as { data: GuestUserDB | null; error: any }

      if (selectError) {
        request.log.error({ error: selectError }, 'Failed to query guest user')
        return reply.status(500).send({
          success: false,
          error: 'Database query failed'
        })
      }

      // 2. 기존 게스트가 있으면 반환
      if (existingGuest) {
        return reply.send({
          success: true,
          data: {
            guest_user_id: existingGuest.id,
            email: existingGuest.email,
            full_name: existingGuest.full_name,
            is_new: false
          }
        })
      }

      // 3. 없으면 신규 생성
      const { data: newGuest, error: insertError } = await (supabase as any)
        .from('guest_users')
        .insert({
          email,
          full_name
        })
        .select('id, email, full_name')
        .single() as { data: GuestUserDB | null; error: any }

      if (insertError || !newGuest) {
        request.log.error({ error: insertError }, 'Failed to create guest user')
        return reply.status(500).send({
          success: false,
          error: 'Failed to create guest user'
        })
      }

      request.log.info({ guestId: newGuest.id, email }, 'Created new guest user')

      return reply.send({
        success: true,
        data: {
          guest_user_id: newGuest.id,
          email: newGuest.email,
          full_name: newGuest.full_name,
          is_new: true
        }
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation failed',
          details: error.errors
        })
      }

      request.log.error({ error }, 'Unexpected error in guest registration')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // GET /guest/info/:email - 게스트 정보 조회
  fastify.get<{ Params: GuestInfoParams }>('/info/:email', {
    schema: {
      tags: ['Guest'],
      summary: '게스트 정보 조회',
      description: '이메일로 게스트 사용자 정보를 조회합니다 (CLI 캐시 확인용)',
      params: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email', description: '게스트 이메일' }
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
                guest_user_id: { type: 'string', format: 'uuid' },
                email: { type: 'string', format: 'email' },
                full_name: { type: 'string' },
                upload_count: { type: 'integer' },
                total_file_size: { type: 'integer' },
                last_upload_at: { type: 'string', format: 'date-time', nullable: true }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async function (request, reply) {
    try {
      const { email } = request.params
      const supabase = getSupabase()

      const { data: guestUser, error } = await supabase
        .from('guest_users')
        .select('id, email, full_name, upload_count, total_file_size, last_upload_at')
        .eq('email', email)
        .maybeSingle() as { data: GuestUserDB | null; error: any }

      if (error) {
        request.log.error({ error }, 'Failed to query guest user')
        return reply.status(500).send({
          success: false,
          error: 'Database query failed'
        })
      }

      if (!guestUser) {
        return reply.status(404).send({
          success: false,
          error: 'Guest user not found'
        })
      }

      return reply.send({
        success: true,
        data: {
          guest_user_id: guestUser.id,
          email: guestUser.email,
          full_name: guestUser.full_name,
          upload_count: guestUser.upload_count || 0,
          total_file_size: guestUser.total_file_size || 0,
          last_upload_at: guestUser.last_upload_at
        }
      })
    } catch (error) {
      request.log.error({ error }, 'Unexpected error in guest info retrieval')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // GET /guest/:guestUserId - 게스트 정보와 세션 목록 조회
  fastify.get<{ Params: { guestUserId: string } }>('/:guestUserId', {
    schema: {
      tags: ['Guest'],
      summary: '게스트 뷰 - 정보 및 세션 목록',
      description: '게스트 사용자 정보와 업로드한 세션 목록을 조회합니다 (퍼블릭 뷰)',
      params: {
        type: 'object',
        required: ['guestUserId'],
        properties: {
          guestUserId: { type: 'string', format: 'uuid', description: '게스트 사용자 ID' }
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
                guest: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    email: { type: 'string', format: 'email' },
                    full_name: { type: 'string' },
                    upload_count: { type: 'integer' },
                    total_file_size: { type: 'integer' },
                    created_at: { type: 'string', format: 'date-time' },
                    last_upload_at: { type: 'string', format: 'date-time', nullable: true }
                  }
                },
                sessions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      session_id: { type: 'string', format: 'uuid' },
                      file_id: { type: 'string', format: 'uuid' },
                      file_name: { type: 'string' },
                      tool_name: { type: 'string' },
                      file_size: { type: 'integer' },
                      upload_status: { type: 'string' },
                      created_at: { type: 'string', format: 'date-time' },
                      start_timestamp: { type: 'string', format: 'date-time', nullable: true },
                      end_timestamp: { type: 'string', format: 'date-time', nullable: true }
                    }
                  }
                }
              }
            }
          }
        },
        404: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          }
        }
      }
    }
  }, async function (request, reply) {
    try {
      const { guestUserId } = request.params
      const supabase = getSupabase()

      // 1. 게스트 사용자 정보 조회
      const { data: guestUser, error: guestError } = await supabase
        .from('guest_users')
        .select('*')
        .eq('id', guestUserId)
        .maybeSingle() as { data: GuestUserDB | null; error: any }

      if (guestError) {
        request.log.error({ error: guestError }, 'Failed to query guest user')
        return reply.status(500).send({
          success: false,
          error: 'Database query failed'
        })
      }

      if (!guestUser) {
        return reply.status(404).send({
          success: false,
          error: 'Guest user not found'
        })
      }

      // 2. 업로드된 파일 목록 조회
      const { data: files, error: filesError } = await supabase
        .from('uploaded_files')
        .select('id, original_filename, tool_name, file_size, upload_status, created_at')
        .eq('guest_user_id', guestUserId)
        .order('created_at', { ascending: false }) as { data: FileDB[] | null; error: any }

      if (filesError) {
        request.log.error({ error: filesError }, 'Failed to query files')
        return reply.status(500).send({
          success: false,
          error: 'Failed to load sessions'
        })
      }

      // 3. 각 파일에 대한 세션 정보 및 메시지 조회
      const sessions = []
      for (const file of files || []) {
        // 세션 기본 정보 조회
        const { data: session } = await supabase
          .from('sessions')
          .select('session_id, start_timestamp, end_timestamp, total_messages, total_tokens, prompt_count, project_name')
          .eq('file_id', file.id)
          .maybeSingle() as { data: SessionDB | null; error: any }

        // 세션 메시지 내용 조회
        let sessionMessages: SessionMessageDB[] = []
        if (session) {
          const { data: messages } = await supabase
            .from('session_content')
            .select('*')
            .eq('session_id', session.session_id)
            .order('sequence', { ascending: true }) as { data: SessionMessageDB[] | null; error: any }

          sessionMessages = messages || []
        }

        // 시작/종료 시간 포맷팅
        const formatTime = (timestamp: string | null | undefined) => {
          if (!timestamp) return null
          const date = new Date(timestamp)
          return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        }

        sessions.push({
          id: file.id,
          session_id: session?.session_id || null,
          file_id: file.id,
          filename: file.original_filename,
          file_name: file.original_filename,
          tool_name: file.tool_name,
          file_size: file.file_size,
          upload_status: file.upload_status,
          upload_time: file.created_at,
          created_at: file.created_at,
          start_timestamp: session?.start_timestamp || null,
          end_timestamp: session?.end_timestamp || null,
          start_time: formatTime(session?.start_timestamp ?? null),
          end_time: formatTime(session?.end_timestamp ?? null),
          total_messages: session?.total_messages || 0,
          total_tokens: session?.total_tokens || 0,
          prompt_count: session?.prompt_count || 0,
          project: session?.project_name || 'No Project',
          project_name: session?.project_name || 'No Project',
          session_content: {
            messages: sessionMessages.map(msg => ({
              type: msg.message_type,
              content: msg.content,
              timestamp: msg.timestamp,
              uuid: msg.message_uuid,
              sequence: msg.sequence,
              is_sidechain: msg.is_sidechain || false,
              subagent_name: msg.subagent_name || null,
              subagent_type: msg.subagent_type || null
            }))
          }
        })
      }

      return reply.send({
        success: true,
        data: {
          guest: {
            id: guestUser.id,
            email: guestUser.email,
            full_name: guestUser.full_name,
            upload_count: guestUser.upload_count || 0,
            total_file_size: guestUser.total_file_size || 0,
            created_at: guestUser.created_at,
            last_upload_at: guestUser.last_upload_at
          },
          sessions
        }
      })
    } catch (error) {
      request.log.error({ error }, 'Unexpected error in guest view')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })
}
