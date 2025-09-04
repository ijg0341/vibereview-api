// 팀 랭킹 API 엔드포인트
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware, requireTeam, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getSupabase } from '../../utils/supabase.js'
import { getTeamRankings, getUserTeamId, validateDate } from '../../utils/stats-aggregator.js'

export default async function teamRankingsRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware
  fastify.addHook('preHandler', authMiddleware)
  fastify.addHook('preHandler', requireTeam())

  // GET /dashboard/team-rankings - 팀 내 일별 랭킹
  fastify.get('/team-rankings', {
    schema: {
      tags: ['Dashboard'],
      summary: '팀 일별 랭킹',
      description: '팀 내 사용자들의 토큰 사용량, 프롬프트 횟수, 메시지량 랭킹 TOP 3를 조회합니다',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            pattern: '^\\d{4}-\\d{2}-\\d{2}$',
            description: '조회할 날짜 (YYYY-MM-DD 형식, 기본값: 오늘)'
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
                date: { type: 'string', description: '조회 날짜' },
                token_ranking: {
                  type: 'array',
                  description: '토큰 사용량 랭킹 TOP 3',
                  items: {
                    type: 'object',
                    properties: {
                      rank: { type: 'number' },
                      user_id: { type: 'string' },
                      user_name: { type: 'string' },
                      user_email: { type: 'string' },
                      value: { type: 'number', description: '토큰 수' },
                      formatted_value: { type: 'string', description: '포맷된 토큰 수' },
                      estimated_cost: { type: 'number', description: '예상 비용' }
                    }
                  }
                },
                prompt_ranking: {
                  type: 'array',
                  description: '프롬프트 횟수 랭킹 TOP 3',
                  items: {
                    type: 'object',
                    properties: {
                      rank: { type: 'number' },
                      user_id: { type: 'string' },
                      user_name: { type: 'string' },
                      user_email: { type: 'string' },
                      value: { type: 'number', description: '프롬프트 횟수' },
                      formatted_value: { type: 'string', description: '포맷된 프롬프트 횟수' }
                    }
                  }
                },
                message_ranking: {
                  type: 'array',
                  description: '메시지량 랭킹 TOP 3',
                  items: {
                    type: 'object',
                    properties: {
                      rank: { type: 'number' },
                      user_id: { type: 'string' },
                      user_name: { type: 'string' },
                      user_email: { type: 'string' },
                      value: { type: 'number', description: '문자수' },
                      formatted_value: { type: 'string', description: '포맷된 문자수' }
                    }
                  }
                }
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
  }, async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { date } = request.query as { date?: string }
      const supabase = getSupabase()

      // 날짜 파라미터 검증 (기본값: 오늘)
      const queryDate = date || new Date().toISOString().split('T')[0]
      
      if (!queryDate || !validateDate(queryDate)) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid date format. Use YYYY-MM-DD format.'
        })
      }

      // 사용자의 팀 ID 조회
      const teamId = await getUserTeamId(supabase, user.id)

      // 팀 랭킹 조회
      const teamRankings = await getTeamRankings(supabase, teamId, queryDate)

      return reply.send({
        success: true,
        data: teamRankings
      })

    } catch (error) {
      request.log.error(error, 'Team rankings error')
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  })
}