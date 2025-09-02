import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware, requireTeam, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getSupabase } from '../../utils/supabase.js'

export default async function statsRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware
  fastify.addHook('preHandler', authMiddleware)
  fastify.addHook('preHandler', requireTeam())

  // GET /stats/dashboard - 메인 대시보드 통계
  fastify.get('/dashboard', {
    schema: {
      tags: ['Stats'],
      summary: '대시보드 통계',
      description: '팀의 전체 통계를 조회합니다. 프로젝트 수, 파일 수, 도구별 사용량 등을 포함합니다',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                overview: {
                  type: 'object',
                  properties: {
                    total_projects: { type: 'number', description: '총 프로젝트 수' },
                    total_files: { type: 'number', description: '총 파일 수' },
                    total_size: { type: 'number', description: '총 파일 크기' },
                    team_members: { type: 'number', description: '팀 멤버 수' },
                    recent_activity: { type: 'number', description: '최근 활동 (7일)' }
                  }
                },
                tool_usage: {
                  type: 'object',
                  description: '도구별 사용량',
                  additionalProperties: {
                    type: 'object',
                    properties: {
                      count: { type: 'number' },
                      size: { type: 'number' }
                    }
                  }
                },
                recent_uploads: {
                  type: 'array',
                  description: '최근 업로드 파일 (최대 10개)',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      filename: { type: 'string' },
                      tool_name: { type: 'string' },
                      uploaded_at: { type: 'string' }
                    }
                  }
                },
                upload_trends: {
                  type: 'object',
                  description: '업로드 트렌드',
                  properties: {
                    daily: {
                      type: 'object',
                      description: '일별 업로드 통계 (최근 7일)',
                      additionalProperties: {
                        type: 'object',
                        properties: {
                          count: { type: 'number' },
                          size: { type: 'number' }
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

      // 파일 통계 조회
      const { data: files, error: filesError } = await supabase
        .from('uploaded_files')
        .select('tool_name, file_size, upload_status, created_at, metadata')
        .eq('team_id', user.team_id!) as { data: any; error: any }

      if (filesError) {
        request.log.error(filesError, 'Failed to fetch dashboard stats')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch dashboard statistics'
        })
      }

      // 팀 멤버 수 조회
      const { data: members, error: membersError } = await supabase
        .from('profiles')
        .select('id')
        .eq('team_id', user.team_id!)
        .eq('is_active', true) as { data: any; error: any }

      if (membersError) {
        request.log.error(membersError, 'Failed to fetch team members')
      }

      // 통계 계산
      const totalFiles = files?.length || 0
      const totalSize = files?.reduce((sum: number, file: any) => sum + (file.file_size || 0), 0) || 0
      
      // 프로젝트 수 (unique tool_name + metadata.project 조합)
      const projectsSet = new Set()
      files?.forEach((file: any) => {
        const projectName = file.metadata?.project || file.tool_name || 'Unknown'
        projectsSet.add(projectName)
      })

      // 최근 활동 (최근 7일)
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      const recentFiles = files?.filter((file: any) => 
        new Date(file.created_at) > weekAgo
      ) || []

      // 도구별 사용량
      const toolStats = files?.reduce((acc: Record<string, any>, file: any) => {
        const tool = file.tool_name || 'Unknown'
        if (!acc[tool]) {
          acc[tool] = { count: 0, size: 0 }
        }
        acc[tool].count += 1
        acc[tool].size += file.file_size || 0
        return acc
      }, {}) || {}

      return reply.send({
        success: true,
        data: {
          overview: {
            total_projects: projectsSet.size,
            total_files: totalFiles,
            total_size: totalSize,
            team_members: members?.length || 0,
            recent_activity: recentFiles.length,
          },
          tool_usage: toolStats,
          recent_uploads: recentFiles.slice(0, 10).map((file: any) => ({
            id: file.id,
            filename: file.original_filename,
            tool_name: file.tool_name,
            uploaded_at: file.created_at,
            file_size: file.file_size,
          })),
          upload_trends: {
            // 일별 업로드 수 (최근 7일)
            daily: generateDailyStats(files || [], 7)
          }
        }
      })

    } catch (error) {
      request.log.error(error, 'Dashboard stats error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // GET /stats/projects/{id} - 프로젝트별 통계
  fastify.get('/projects/:projectId', {
    schema: {
      tags: ['Stats'],
      summary: '프로젝트별 통계',
      description: '특정 프로젝트의 상세 통계를 조회합니다',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: '프로젝트 ID' }
        },
        required: ['projectId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                project: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    total_files: { type: 'number' },
                    total_size: { type: 'number' }
                  }
                },
                member_contributions: { type: 'object', description: '멤버별 기여도' },
                upload_trends: { type: 'object', description: '업로드 트렌드' },
                file_types: { type: 'object', description: '파일 타입별 분포' }
              }
            }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { projectId } = request.params as { projectId: string }
      const supabase = getSupabase()

      const projectName = Buffer.from(projectId, 'base64').toString()

      const { data: files, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('team_id', user.team_id!)
        .or(`tool_name.eq.${projectName},metadata->>project.eq.${projectName}`) as { data: any; error: any }

      if (error) {
        request.log.error(error, 'Failed to fetch project stats')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch project statistics'
        })
      }

      const totalFiles = files?.length || 0
      const totalSize = files?.reduce((sum: number, file: any) => sum + (file.file_size || 0), 0) || 0

      // 멤버별 기여도 (업로드한 사람별)
      const memberContributions = files?.reduce((acc: Record<string, any>, file: any) => {
        const userId = file.user_id
        if (!acc[userId]) {
          acc[userId] = { count: 0, size: 0 }
        }
        acc[userId].count += 1
        acc[userId].size += file.file_size || 0
        return acc
      }, {}) || {}

      return reply.send({
        success: true,
        data: {
          project: {
            id: projectId,
            name: projectName,
            total_files: totalFiles,
            total_size: totalSize,
          },
          member_contributions: memberContributions,
          upload_trends: {
            daily: generateDailyStats(files || [], 30)
          },
          file_types: files?.reduce((acc: Record<string, number>, file: any) => {
            const ext = file.original_filename.split('.').pop() || 'unknown'
            acc[ext] = (acc[ext] || 0) + 1
            return acc
          }, {}) || {}
        }
      })

    } catch (error) {
      request.log.error(error, 'Project stats error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // GET /stats/users/{id} - 사용자별 통계
  fastify.get('/users/:userId', {
    schema: {
      tags: ['Stats'],
      summary: '사용자별 통계',
      description: '특정 사용자의 활동 통계를 조회합니다',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: '사용자 ID' }
        },
        required: ['userId']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                user_id: { type: 'string' },
                activity: {
                  type: 'object',
                  properties: {
                    total_files: { type: 'number', description: '총 업로드 파일 수' },
                    total_size: { type: 'number', description: '총 파일 크기' },
                    projects_count: { type: 'number', description: '참여 프로젝트 수' }
                  }
                },
                upload_trends: { type: 'object', description: '업로드 트렌드' },
                tool_preferences: { type: 'object', description: '선호 도구 사용량' }
              }
            }
          }
        }
      }
    }
  }, async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { userId } = request.params as { userId: string }
      const supabase = getSupabase()

      const { data: userFiles, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('team_id', user.team_id!)
        .eq('user_id', userId) as { data: any; error: any }

      if (error) {
        request.log.error(error, 'Failed to fetch user stats')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch user statistics'
        })
      }

      const totalFiles = userFiles?.length || 0
      const totalSize = userFiles?.reduce((sum: number, file: any) => sum + (file.file_size || 0), 0) || 0

      // 프로젝트 참여 현황
      const projectsSet = new Set()
      userFiles?.forEach((file: any) => {
        const projectName = file.metadata?.project || file.tool_name || 'Unknown'
        projectsSet.add(projectName)
      })

      return reply.send({
        success: true,
        data: {
          user_id: userId,
          activity: {
            total_files: totalFiles,
            total_size: totalSize,
            projects_count: projectsSet.size,
          },
          upload_trends: {
            daily: generateDailyStats(userFiles || [], 30)
          },
          tool_preferences: userFiles?.reduce((acc: Record<string, number>, file: any) => {
            const tool = file.tool_name || 'Unknown'
            acc[tool] = (acc[tool] || 0) + 1
            return acc
          }, {}) || {}
        }
      })

    } catch (error) {
      request.log.error(error, 'User stats error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })
}

// 헬퍼 함수: 일별 통계 생성
function generateDailyStats(files: any[], days: number) {
  const stats: Record<string, { count: number; size: number }> = {}
  
  // 지난 N일 동안의 날짜 생성
  for (let i = 0; i < days; i++) {
    const date = new Date()
    date.setDate(date.getDate() - i)
    const dateStr = date.toISOString().split('T')[0]
    stats[dateStr] = { count: 0, size: 0 }
  }

  // 파일 데이터로 통계 채우기
  files.forEach(file => {
    const dateStr = file.created_at.split('T')[0]
    if (stats[dateStr]) {
      stats[dateStr].count += 1
      stats[dateStr].size += file.file_size || 0
    }
  })

  return stats
}