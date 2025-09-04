// 개인 통계 API 엔드포인트
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware, requireTeam, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getSupabase } from '../../utils/supabase.js'
import { getPersonalStats, validateDate } from '../../utils/stats-aggregator.js'

export default async function personalStatsRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware
  fastify.addHook('preHandler', authMiddleware)
  fastify.addHook('preHandler', requireTeam())

  // GET /dashboard/personal-stats - 개인 일별 통계
  fastify.get('/personal-stats', {
    schema: {
      tags: ['Dashboard'],
      summary: '개인 일별 통계',
      description: '사용자의 일별 토큰 사용량, 프롬프트 횟수, 예상 비용 등을 조회합니다',
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
                total_tokens: { type: 'number', description: '총 토큰 사용량 (Input + Output)' },
                input_tokens: { type: 'number', description: 'Input 토큰' },
                output_tokens: { type: 'number', description: 'Output 토큰' },
                cached_tokens: { type: 'number', description: 'Cached 토큰' },
                estimated_cost: { type: 'number', description: '예상 비용 (USD)' },
                prompt_count: { type: 'number', description: '프롬프트 횟수' },
                message_chars: { type: 'number', description: '작성한 문자수' },
                tool_breakdown: {
                  type: 'array',
                  description: '도구별 세부 통계',
                  items: {
                    type: 'object',
                    properties: {
                      tool_name: { type: 'string' },
                      tokens: { type: 'number' },
                      cost: { type: 'number' },
                      model: { type: 'string' }
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

      // 개인 통계 조회
      const personalStats = await getPersonalStats(supabase, user.id, queryDate)

      return reply.send({
        success: true,
        data: personalStats
      })

    } catch (error) {
      request.log.error(error, 'Personal stats error')
      return reply.status(500).send({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      })
    }
  })
}