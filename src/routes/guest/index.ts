import type { FastifyInstance, FastifyRequest } from 'fastify'
import { getSupabase } from '../../utils/supabase.js'
import { generateWithClaude } from '../../utils/claude-api.js'
import { parseSummaryJson, serializeParsedData } from '../../utils/summary-parser.js'
import { extractProjectTexts, generateSummaryPrompt, getPromptStats, type ProjectText } from '../../utils/summary-prompt.js'
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
  id: string
  session_id: string
  start_timestamp?: string
  end_timestamp?: string
  total_messages?: number
  total_input_tokens?: number
  total_output_tokens?: number
  user_messages_count?: number
  working_directory?: string
  tool_name?: string
}

interface FileDB {
  id: string
  original_filename: string
  tool_name: string
  file_size: number
  upload_status: string
  created_at: string
}

interface SessionContentDB {
  session_id: string
  messages: any
}

// interface DailySummaryDB {
//   summary_text: string
//   created_at: string
// }

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
                      id: { type: 'string' },
                      session_id: { type: 'string', nullable: true },
                      file_id: { type: 'string' },
                      filename: { type: 'string' },
                      file_name: { type: 'string' },
                      tool_name: { type: 'string' },
                      file_size: { type: 'integer' },
                      upload_status: { type: 'string' },
                      upload_time: { type: 'string' },
                      created_at: { type: 'string' },
                      start_timestamp: { type: 'string', nullable: true },
                      end_timestamp: { type: 'string', nullable: true },
                      start_time: { type: 'string', nullable: true },
                      end_time: { type: 'string', nullable: true },
                      total_messages: { type: 'integer' },
                      total_tokens: { type: 'integer' },
                      prompt_count: { type: 'integer' },
                      project: { type: 'string' },
                      project_name: { type: 'string' },
                      session_content: {
                        type: 'object',
                        additionalProperties: true
                      }
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
        const { data: session, error: sessionError } = await supabase
          .from('sessions')
          .select('id, session_id, start_timestamp, end_timestamp, total_messages, total_input_tokens, total_output_tokens, user_messages_count, working_directory, tool_name')
          .eq('file_id', file.id)
          .maybeSingle() as { data: SessionDB | null; error: any }

        if (sessionError) {
          request.log.error({ error: sessionError, fileId: file.id }, 'Failed to query session')
        }

        // 세션 메시지 내용 조회
        let sessionMessages: any[] = []
        if (session) {
          const { data: content, error: contentError } = await supabase
            .from('session_content')
            .select('messages')
            .eq('session_id', session.id)
            .maybeSingle() as { data: SessionContentDB | null; error: any }

          if (contentError) {
            request.log.error({ error: contentError, sessionId: session.id }, 'Failed to query session content')
          }

          // messages는 { messages: [...] } 형태의 JSONB 객체
          // 실제 배열은 messages.messages에 있음
          if (content?.messages) {
            sessionMessages = (content.messages as any).messages || content.messages || []
          }
        }

        // 시작/종료 시간 포맷팅
        const formatTime = (timestamp: string | null | undefined) => {
          if (!timestamp) return null
          const date = new Date(timestamp)
          return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
        }

        // Extract project name from working_directory
        const projectName = session?.working_directory
          ? session.working_directory.split('/').pop() || 'No Project'
          : 'No Project'

        sessions.push({
          id: file.id,
          session_id: session?.session_id || null,
          file_id: file.id,
          filename: file.original_filename,
          file_name: file.original_filename,
          tool_name: file.tool_name || session?.tool_name || 'claude-code',
          file_size: file.file_size,
          upload_status: file.upload_status,
          upload_time: file.created_at,
          created_at: file.created_at,
          start_timestamp: session?.start_timestamp || null,
          end_timestamp: session?.end_timestamp || null,
          start_time: formatTime(session?.start_timestamp ?? null),
          end_time: formatTime(session?.end_timestamp ?? null),
          total_messages: session?.total_messages || 0,
          total_tokens: (session?.total_input_tokens || 0) + (session?.total_output_tokens || 0),
          prompt_count: session?.user_messages_count || 0,
          project: projectName,
          project_name: projectName,
          session_content: {
            messages: sessionMessages
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

  // POST /guest/generate-summary - 게스트용 AI 요약 생성 (토큰 불필요)
  const generateSummarySchema = z.object({
    userId: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    projectTexts: z.array(z.object({
      projectName: z.string(),
      userText: z.string(),
    })).optional(),
    forceRegenerate: z.boolean().optional().default(false),
  })

  fastify.post<{ Body: any }>('/generate-summary', {
    schema: {
      tags: ['Guest'],
      summary: '게스트 AI 요약 생성',
      description: '게스트 사용자의 세션 AI 요약을 생성합니다 (토큰 불필요)',
      body: {
        type: 'object',
        required: ['userId', 'date'],
        properties: {
          userId: { type: 'string', format: 'uuid', description: '게스트 사용자 ID' },
          date: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: '날짜 (YYYY-MM-DD)' },
          projectTexts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                projectName: { type: 'string' },
                userText: { type: 'string' }
              }
            }
          },
          forceRegenerate: { type: 'boolean', default: false }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object', additionalProperties: true }
          }
        }
      }
    }
  }, async function (request, reply) {
    try {
      const { userId, date, projectTexts, forceRegenerate } = generateSummarySchema.parse(request.body)
      const supabase = getSupabase()

      // 게스트 사용자 확인
      const { data: guestUser, error: guestError } = await supabase
        .from('guest_users')
        .select('id')
        .eq('id', userId)
        .maybeSingle()

      if (guestError || !guestUser) {
        return reply.status(404).send({
          success: false,
          error: 'Guest user not found'
        })
      }

      // 기존 요약 확인 (guest_user_id 사용)
      if (!forceRegenerate) {
        request.log.info({ userId, date }, '[Cache Check] Checking for existing summary')

        const { data: existingSummary, error: cacheError } = await supabase
          .from('daily_ai_summaries')
          .select('summary_text, created_at, daily_summary, work_categories, project_todos, quality_score, quality_score_explanation, parsed_data')
          .eq('guest_user_id', userId)
          .eq('date', date)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle() as any

        if (cacheError) {
          request.log.error({ error: cacheError, userId, date }, '[Cache Error] Failed to check existing summary')
        }

        if (existingSummary) {
          request.log.info({
            userId,
            date,
            cached_at: existingSummary.created_at
          }, '[Cache Hit] Returning cached summary')

          // daily_summary는 JSON 문자열이므로 파싱
          let dailySummary = {}
          try {
            dailySummary = existingSummary.daily_summary ? JSON.parse(existingSummary.daily_summary as string) : {}
          } catch (e) {
            dailySummary = {}
          }

          return reply.send({
            success: true,
            data: {
              summary: existingSummary.summary_text,
              cached: true,
              created_at: existingSummary.created_at,
              parsed_data: existingSummary.parsed_data,
              daily_summary: dailySummary,
              work_categories: existingSummary.work_categories,
              project_todos: existingSummary.project_todos,
              quality_score: existingSummary.quality_score,
              quality_score_explanation: existingSummary.quality_score_explanation,
              parse_errors: [],
            },
          })
        } else {
          request.log.info({ userId, date }, '[Cache Miss] No cached summary found, generating new one')
        }
      } else {
        request.log.info({ userId, date }, '[Force Regenerate] Skipping cache check')
      }

      // 프로젝트 텍스트가 없으면 세션 데이터에서 추출
      let projectData: ProjectText[] = projectTexts || []
      if (!projectTexts || projectTexts.length === 0) {
        // 1. 먼저 게스트의 업로드 파일 조회
        const { data: files, error: filesError } = await supabase
          .from('uploaded_files')
          .select('id, created_at')
          .eq('guest_user_id', userId)
          .gte('created_at', `${date}T00:00:00`)
          .lt('created_at', `${date}T23:59:59`)

        if (filesError) {
          request.log.error({ error: filesError }, 'Failed to query uploaded files')
        }

        if (!files || files.length === 0) {
          return reply.send({
            success: true,
            data: {
              summary: '이 날짜에는 작업한 내용이 없습니다.',
              cached: false,
            },
          })
        }

        // 2. 파일 ID로 세션 조회
        const fileIds = files.map((f: { id: string }) => f.id)
        const { data: sessions } = await supabase
          .from('sessions')
          .select('id, session_id, working_directory')
          .in('file_id', fileIds)

        if (!sessions || sessions.length === 0) {
          return reply.send({
            success: true,
            data: {
              summary: '이 날짜에는 작업한 내용이 없습니다.',
              cached: false,
            },
          })
        }

        // 3. session_content에서 사용자 메시지 추출
        const sessionIds = sessions.map((s: any) => s.id)
        const { data: contents } = await supabase
          .from('session_content')
          .select('session_id, messages')
          .in('session_id', sessionIds)

        // 4. 프로젝트명을 working_directory에서 추출
        const sessionsWithProject = sessions.map((s: any) => ({
          ...s,
          project_name: s.working_directory ? s.working_directory.split('/').pop() : 'Unknown Project'
        }))

        projectData = extractProjectTexts(sessionsWithProject, contents || [])
      }

      if (projectData.length === 0) {
        return reply.send({
          success: true,
          data: {
            summary: '이 날짜에는 작업한 내용이 없습니다.',
            cached: false,
          },
        })
      }

      // AI 요약 생성
      const analysisPrompt = generateSummaryPrompt(date, projectData)
      const stats = getPromptStats(analysisPrompt, projectData)

      request.log.info({
        promptLength: stats.promptLength,
        projectCount: stats.projectCount,
        totalMessages: stats.totalMessages,
        userId,
        date
      }, 'Generating AI summary for guest')

      const summary = await generateWithClaude(analysisPrompt)
      const parsedData = parseSummaryJson(summary)
      const serializedParsedData = serializeParsedData(parsedData)

      // DB에 저장 (guest_user_id 사용)
      // 먼저 기존 summary 삭제 후 insert (upsert 대신)
      const { error: deleteError } = await supabase
        .from('daily_ai_summaries')
        .delete()
        .eq('guest_user_id', userId)
        .eq('date', date)

      if (deleteError) {
        request.log.warn({ error: deleteError }, '[Cache] Failed to delete old summary, continuing...')
      }

      const { error: saveError } = await supabase
        .from('daily_ai_summaries')
        .insert({
          guest_user_id: userId,
          user_id: null,
          date,
          summary_text: summary,
          project_texts: projectData,
          force_regenerated: forceRegenerate,
          parsed_data: JSON.parse(serializedParsedData),
          daily_summary: JSON.stringify(parsedData.summary),  // 객체를 JSON 문자열로 변환
          work_categories: parsedData.work_categories,
          project_todos: parsedData.project_todos,
          quality_score: parsedData.quality_score,
          quality_score_explanation: parsedData.quality_score_explanation
        } as any)

      if (saveError) {
        request.log.error({
          error: saveError,
          code: saveError.code,
          message: saveError.message,
          details: saveError.details,
          hint: saveError.hint
        }, 'Failed to save AI summary')
      } else {
        request.log.info({ userId, date }, '[Cache Saved] Successfully saved summary to cache')
      }

      return reply.send({
        success: true,
        data: {
          summary,
          cached: false,
          project_count: projectData.length,
          parsed_data: parsedData,
          daily_summary: parsedData.summary,
          work_categories: parsedData.work_categories,
          project_todos: parsedData.project_todos,
          quality_score: parsedData.quality_score,
          quality_score_explanation: parsedData.quality_score_explanation,
          parse_errors: parsedData.errors,
        },
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid input',
          details: error.issues,
        })
      }

      request.log.error(error, 'Generate summary error for guest')
      return reply.status(500).send({
        success: false,
        error: 'Failed to generate summary',
      })
    }
  })
}
