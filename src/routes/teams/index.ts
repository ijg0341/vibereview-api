import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware, requireTeam, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getSupabase } from '../../utils/supabase.js'

export default async function teamsRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware
  fastify.addHook('preHandler', authMiddleware)
  fastify.addHook('preHandler', requireTeam())

  // GET /teams/current/members - 현재 팀의 모든 멤버 목록
  fastify.get('/current/members', {
    schema: {
      tags: ['Teams'],
      summary: '팀 멤버 목록 조회',
      description: '현재 팀에 속한 모든 멤버들과 활동 요약을 조회합니다',
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                team: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    member_count: { type: 'number' }
                  }
                },
                members: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      email: { type: 'string' },
                      full_name: { type: 'string' },
                      username: { type: 'string' },
                      avatar_url: { type: 'string' },
                      role: { type: 'string' },
                      activity_summary: {
                        type: 'object',
                        properties: {
                          total_files: { type: 'number' },
                          total_size: { type: 'number' },
                          last_upload: { type: 'string' },
                          favorite_tool: { type: 'string' },
                          projects_count: { type: 'number' }
                        }
                      }
                    }
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

      // 팀 정보 조회
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .select('id, name, description')
        .eq('id', user.team_id!)
        .single() as { data: any; error: any }

      if (teamError) {
        request.log.error(teamError, 'Failed to fetch team info')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch team information'
        })
      }

      // 팀 멤버들 조회
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url, role, is_active, created_at')
        .eq('team_id', user.team_id!)
        .eq('is_active', true) as { data: any; error: any }

      if (profilesError) {
        request.log.error(profilesError, 'Failed to fetch team members')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch team members'
        })
      }

      // 각 멤버의 활동 요약 계산
      const membersWithActivity = await Promise.all(
        (profiles || []).map(async (profile: any) => {
          // 멤버의 파일 업로드 통계
          const { data: files } = await supabase
            .from('uploaded_files')
            .select('file_size, tool_name, metadata, created_at')
            .eq('user_id', profile.id) as { data: any }

          const totalFiles = files?.length || 0
          const totalSize = files?.reduce((sum: number, file: any) => sum + (file.file_size || 0), 0) || 0

          // 가장 많이 사용한 도구
          const toolCounts = files?.reduce((acc: Record<string, number>, file: any) => {
            const tool = file.tool_name || 'Unknown'
            acc[tool] = (acc[tool] || 0) + 1
            return acc
          }, {}) || {}
          
          const favoriteTools = Object.entries(toolCounts)
            .sort(([,a], [,b]) => (b as number) - (a as number))
          const favoriteTool = favoriteTools[0]?.[0] || 'None'

          // 프로젝트 수
          const projectsSet = new Set()
          files?.forEach((file: any) => {
            const projectName = file.metadata?.project || file.tool_name || 'Default'
            projectsSet.add(projectName)
          })

          // 마지막 업로드
          const lastUpload = files?.length > 0 
            ? files[files.length - 1]?.created_at 
            : null

          return {
            id: profile.id,
            full_name: profile.full_name,
            username: profile.username,
            avatar_url: profile.avatar_url,
            role: profile.role,
            created_at: profile.created_at,
            activity_summary: {
              total_files: totalFiles,
              total_size: totalSize,
              last_upload: lastUpload,
              favorite_tool: favoriteTool,
              projects_count: projectsSet.size,
              average_file_size: totalFiles > 0 ? Math.round(totalSize / totalFiles) : 0
            }
          }
        })
      )

      return reply.send({
        success: true,
        data: {
          team: {
            id: team.id,
            name: team.name,
            description: team.description,
            member_count: profiles?.length || 0
          },
          members: membersWithActivity
        }
      })

    } catch (error) {
      request.log.error(error, 'Get team members error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // GET /teams/current/members/{userId} - 팀 멤버 상세 통계
  fastify.get('/current/members/:userId', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { userId } = request.params as { userId: string }
      const supabase = getSupabase()

      // 멤버 정보 확인 (같은 팀인지 검증)
      const { data: member, error: memberError } = await supabase
        .from('profiles')
        .select('id, full_name, username, role, created_at')
        .eq('id', userId)
        .eq('team_id', user.team_id!)
        .single() as { data: any; error: any }

      if (memberError || !member) {
        return reply.status(404).send({
          success: false,
          error: 'Team member not found'
        })
      }

      // 멤버의 모든 세션 데이터 조회 (session_summary 기준)
      const { data: sessions, error: sessionsError } = await supabase
        .from('session_summary')
        .select('*')
        .eq('user_id', userId)
        .order('session_date', { ascending: false }) as { data: any; error: any }

      if (sessionsError) {
        request.log.error(sessionsError, 'Failed to fetch member sessions')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch member activity data'
        })
      }

      // 상세 인사이트 계산 (session_summary 기준)
      request.log.info({ sessionCount: sessions?.length, sampleSession: sessions?.[0] }, 'Sessions data for insights calculation')
      const insights = calculateMemberInsights(sessions || [])
      
      // 일별 카드 생성 (최근 30일, session_date 기준)
      const dailyCards = generateDailyCards(sessions || [], 30)

      return reply.send({
        success: true,
        data: {
          member: {
            id: member.id,
            full_name: member.full_name,
            username: member.username,
            role: member.role,
            joined_at: member.created_at
          },
          insights,
          daily_cards: dailyCards
        }
      })

    } catch (error) {
      request.log.error(error, 'Get member details error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // GET /teams/current/members/{userId}/daily/{date} - 일별 세션 상세  
  fastify.get('/current/members/:userId/daily/:date', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { userId, date } = request.params as { userId: string; date: string }
      const supabase = getSupabase()

      // 멤버 정보 확인
      const { data: member, error: memberError } = await supabase
        .from('profiles')
        .select('id, full_name, username, role')
        .eq('id', userId)
        .eq('team_id', user.team_id!)
        .single() as { data: any; error: any }

      if (memberError || !member) {
        return reply.status(404).send({
          success: false,
          error: 'Team member not found'
        })
      }

      // 해당 날짜의 세션들 조회 (session_summary만 사용)
      const { data: sessions, error: sessionsError } = await supabase
        .from('session_summary')
        .select('*')
        .eq('user_id', userId)
        .eq('session_date', date)
        .order('start_timestamp', { ascending: true }) as { data: any; error: any }

      // 디버그 로깅
      request.log.info({ 
        sessionCount: sessions?.length,
        sampleSession: sessions?.[0],
        date,
        userId
      }, 'Sessions data fetched')

      // session_summary.id로 session_content 조회
      let sessionContents: Record<string, any> = {}
      if (sessions?.length > 0) {
        const summaryIds = sessions.map((s: any) => s.id) // session_summary.id 사용
        
        const { data: contents } = await supabase
          .from('session_content')
          .select('session_id, messages, message_count')
          .in('session_id', summaryIds) as { data: any; error: any }
        
        sessionContents = (contents || []).reduce((acc: Record<string, any>, content: any) => {
          acc[content.session_id] = content
          return acc
        }, {})
        
        request.log.info({
          summaryIds: summaryIds.slice(0, 3),
          contentCount: contents?.length,
          contentKeys: Object.keys(sessionContents)
        }, 'Session contents fetched by summary ID')
      }

      if (sessionsError) {
        request.log.error(sessionsError, 'Failed to fetch daily sessions')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch daily sessions'
        })
      }

      // 일별 통계 계산
      const dailyStats = calculateDailyStats(sessions || [], date)

      // 세션 상세 정보 구성 (명시적 타입 지정)
      interface SessionDetail {
        id: string
        session_id: string
        project_name: string
        duration_minutes: number
        start_time: string
        end_time: string
        total_messages: number
        prompt_count: number
        total_tokens: number
        total_input_tokens: number
        total_output_tokens: number
        working_directory: string
        git_branch: string
        model_names: string[]
        session_content: {
          messages: any[]
          message_count: number
          has_content: boolean
        }
      }

      const detailedSessions: SessionDetail[] = (sessions || []).map((session: any) => {
        const content = sessionContents[session.id] || {} // session_summary.id로 조회
        
        const sessionDetail: SessionDetail = {
          id: session.session_id,
          session_id: session.session_id,
          project_name: session.project_name || 'unknown',
          duration_minutes: Number(session.duration_minutes) || 0,
          start_time: session.start_timestamp ? new Date(session.start_timestamp).toLocaleTimeString('ko-KR') : '',
          end_time: session.end_timestamp ? new Date(session.end_timestamp).toLocaleTimeString('ko-KR') : '',
          total_messages: Number(session.total_messages) || 0,
          prompt_count: Number(session.prompt_count) || 0,
          total_tokens: Number(session.total_tokens) || 0,
          total_input_tokens: Number(session.total_input_tokens) || 0,
          total_output_tokens: Number(session.total_output_tokens) || 0,
          working_directory: String(session.working_directory || ''),
          git_branch: String(session.git_branch || ''),
          model_names: Array.isArray(session.model_names) ? session.model_names : [],
          session_content: content.messages || null
        }
        
        return sessionDetail
      })

      // 최종 응답 디버그
      request.log.info({
        sessionsCount: detailedSessions.length,
        firstSession: detailedSessions[0],
        secondSession: detailedSessions[1]
      }, 'Actual session data being sent')

      return reply.send({
        success: true,
        data: {
          date,
          member: {
            id: member.id,
            full_name: member.full_name,
            username: member.username,
            role: member.role
          },
          daily_stats: dailyStats,
          sessions: detailedSessions
        }
      })

    } catch (error) {
      request.log.error(error, 'Get daily sessions error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // DEBUG: 테스트 엔드포인트
  fastify.get('/current/members/:userId/debug', async function (_request: FastifyRequest, reply) {
    return reply.send({
      success: true,
      test_data: {
        simple_string: "hello",
        simple_number: 123,
        simple_object: {
          name: "test",
          value: 456
        },
        simple_array: [
          { id: "1", name: "first", value: 100 },
          { id: "2", name: "second", value: 200 }
        ]
      }
    })
  })
}

// 멤버 인사이트 계산 함수 (session_summary 기준)
function calculateMemberInsights(sessions: any[]) {
  console.log('calculateMemberInsights called with:', sessions.length, 'sessions')
  
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  // 기본 통계
  const totalSessions = sessions.length
  const totalTokens = sessions.reduce((sum, session) => sum + (session.total_tokens || 0), 0)
  const totalDuration = sessions.reduce((sum, session) => sum + (session.duration_minutes || 0), 0)
  
  console.log('Basic stats:', { totalSessions, totalTokens, totalDuration })

  // 프로젝트별 사용량
  const projectUsage = sessions.reduce((acc: Record<string, number>, session) => {
    const project = session.project_name || 'unknown'
    acc[project] = (acc[project] || 0) + 1
    return acc
  }, {})

  // 시간대별 활동 (24시간)
  const hourlyActivity = sessions.reduce((acc: Record<number, number>, session) => {
    if (session.start_timestamp) {
      const hour = new Date(session.start_timestamp).getHours()
      acc[hour] = (acc[hour] || 0) + 1
    }
    return acc
  }, {})

  // 가장 활발한 시간대
  const peakHours = Object.entries(hourlyActivity)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([hour]) => `${hour}시`)

  // 요일별 활동
  const weekdayActivity = sessions.reduce((acc: Record<number, number>, session) => {
    if (session.session_date) {
      const weekday = new Date(session.session_date).getDay()
      acc[weekday] = (acc[weekday] || 0) + 1
    }
    return acc
  }, {})

  // 최근 30일 활동
  const recentSessions = sessions.filter(session => 
    session.session_date && new Date(session.session_date) > thirtyDaysAgo
  )

  // 연속 활동 일수 계산
  const activityDates = [...new Set(sessions.map(session => 
    session.session_date
  ))].filter(Boolean).sort()

  let streakDays = 0
  const currentDate = new Date()
  for (let i = 0; i < 30; i++) {
    const checkDate = new Date(currentDate)
    checkDate.setDate(currentDate.getDate() - i)
    const dateStr = checkDate.toISOString().split('T')[0]
    
    if (activityDates.includes(dateStr)) {
      streakDays++
    } else if (i > 0) {
      break
    }
  }

  return {
    overview: {
      total_sessions: totalSessions,
      total_tokens: totalTokens,
      total_duration_minutes: totalDuration,
      average_tokens: totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0,
      recent_activity: recentSessions.length,
      activity_percentage: totalSessions > 0 ? Math.round((recentSessions.length / totalSessions) * 100) : 0
    },
    patterns: {
      favorite_projects: Object.entries(projectUsage)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 5)
        .map(([project, count]) => ({ project, count })),
      peak_hours: peakHours,
      most_active_weekday: getDayName(
        Object.entries(weekdayActivity)
          .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0]
      ),
      current_streak: streakDays
    },
    productivity: {
      daily_average: totalSessions > 0 ? (totalSessions / Math.max(1, activityDates.length)) : 0,
      token_efficiency: totalTokens / Math.max(1, totalSessions),
      consistency_score: calculateConsistencyScore(activityDates),
      recent_trend: calculateTrend(recentSessions)
    },
    milestones: {
      first_session: sessions.length > 0 ? sessions[sessions.length - 1].session_date : null,
      longest_session: sessions.reduce((max, session) => 
        (session.duration_minutes || 0) > (max?.duration_minutes || 0) ? session : max, null
      ),
      most_productive_day: getMostProductiveDay(sessions),
      total_projects: [...new Set(sessions.map(session => 
        session.project_name || 'unknown'
      ))].length
    }
  }
}

// 일별 카드 생성 함수 (session_summary 기준)
function generateDailyCards(sessions: any[], days: number) {
  const cards: Record<string, any> = {}
  
  // 날짜별로 세션 그룹화
  sessions.forEach(session => {
    const date = session.session_date
    if (!date) return
    
    if (!cards[date]) {
      cards[date] = {
        date,
        sessions: [],
        projects: new Set(),
        total_tokens: 0,
        total_duration: 0,
        hours: new Set()
      }
    }
    
    cards[date].sessions.push(session)
    cards[date].projects.add(session.project_name || 'unknown')
    cards[date].total_tokens += session.total_tokens || 0
    cards[date].total_duration += session.duration_minutes || 0
    if (session.start_timestamp) {
      cards[date].hours.add(new Date(session.start_timestamp).getHours())
    }
  })

  // 카드 형태로 변환
  return Object.values(cards)
    .map((card: any) => ({
      date: card.date,
      session_count: card.sessions.length,
      total_tokens: card.total_tokens,
      total_duration: card.total_duration,
      average_tokens: card.sessions.length > 0 ? Math.round(card.total_tokens / card.sessions.length) : 0,
      projects_used: Array.from(card.projects),
      active_hours: Array.from(card.hours).sort().map(h => `${h}시`),
      projects: Array.from(card.projects)
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, days)
}

// 일별 통계 계산 함수 (session_summary 기준)
function calculateDailyStats(sessions: any[], _date: string) {
  const totalSessions = sessions.length
  const totalTokens = sessions.reduce((sum, s) => sum + (s.total_tokens || 0), 0)
  const totalMessages = sessions.reduce((sum, s) => sum + (s.total_messages || 0), 0)
  const totalDuration = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0)

  const projectUsage = sessions.reduce((acc: Record<string, number>, session) => {
    const project = session.project_name || 'unknown'
    acc[project] = (acc[project] || 0) + 1
    return acc
  }, {})

  const hourlyDistribution = sessions.reduce((acc: Record<number, number>, session) => {
    if (session.start_timestamp) {
      const hour = new Date(session.start_timestamp).getHours()
      acc[hour] = (acc[hour] || 0) + 1
    }
    return acc
  }, {})

  const projects = [...new Set(sessions.map(session => 
    session.project_name || 'unknown'
  ))]

  const modelNames = [...new Set(sessions.flatMap(session => 
    session.model_names || []
  ))]

  return {
    overview: {
      total_sessions: totalSessions,
      total_tokens: totalTokens,
      total_messages: totalMessages,
      total_duration_minutes: totalDuration,
      average_tokens: totalSessions > 0 ? Math.round(totalTokens / totalSessions) : 0,
      average_duration: totalSessions > 0 ? Math.round(totalDuration / totalSessions) : 0,
      unique_projects: projects.length
    },
    projects: projectUsage,
    hourly_distribution: hourlyDistribution,
    project_list: projects,
    models_used: modelNames,
    time_span: {
      first_session: sessions.length > 0 ? sessions[0].start_timestamp : null,
      last_session: sessions.length > 0 ? sessions[sessions.length - 1].end_timestamp : null
    }
  }
}

// 헬퍼 함수들
function getDayName(dayNumber: string | undefined): string {
  if (!dayNumber) return 'Unknown'
  const days = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']
  return days[parseInt(dayNumber)] || 'Unknown'
}

function calculateConsistencyScore(dates: string[]): number {
  if (dates.length < 2) return 0
  
  const gaps = []
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] || '')
    const current = new Date(dates[i] || '')
    const gap = Math.abs(current.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24)
    gaps.push(gap)
  }
  
  const avgGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length
  return Math.max(0, Math.min(100, 100 - avgGap * 5)) // 일 단위 간격에 따른 점수
}

function calculateTrend(recentFiles: any[]): 'increasing' | 'decreasing' | 'stable' {
  if (recentFiles.length < 4) return 'stable'
  
  const half = Math.floor(recentFiles.length / 2)
  const firstHalf = recentFiles.slice(-half)
  const secondHalf = recentFiles.slice(0, half)
  
  const firstAvg = firstHalf.length
  const secondAvg = secondHalf.length
  
  if (secondAvg > firstAvg * 1.2) return 'increasing'
  if (secondAvg < firstAvg * 0.8) return 'decreasing'
  return 'stable'
}

function getMostProductiveDay(files: any[]): { date: string; sessions: number; size: number } | null {
  if (files.length === 0) return null
  
  const dailyData = files.reduce((acc: Record<string, any>, file) => {
    const date = file.created_at.split('T')[0]
    if (!acc[date]) {
      acc[date] = { date, sessions: 0, size: 0 }
    }
    acc[date].sessions += 1
    acc[date].size += file.file_size || 0
    return acc
  }, {})

  return Object.values(dailyData)
    .sort((a: any, b: any) => b.sessions - a.sessions)[0] as any || null
}