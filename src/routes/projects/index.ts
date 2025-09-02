import type { FastifyInstance, FastifyRequest } from 'fastify'
import { authMiddleware, requireTeam, type AuthenticatedRequest } from '../../middleware/auth.js'
import { getSupabase } from '../../utils/supabase.js'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  folder_path: z.string().optional(),
})

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  folder_path: z.string().optional(),
})

export default async function projectRoutes(fastify: FastifyInstance) {
  // Apply authentication middleware
  fastify.addHook('preHandler', authMiddleware)
  fastify.addHook('preHandler', requireTeam())

  // GET /projects - 프로젝트 목록 조회 (uploaded_files 기반)
  fastify.get('/', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const supabase = getSupabase()

      // tool_name 기준으로 그룹화해서 가상 프로젝트 목록 생성
      const { data: files, error } = await supabase
        .from('uploaded_files')
        .select('tool_name, metadata, created_at, file_size')
        .eq('team_id', user.team_id!)
        .order('created_at', { ascending: false }) as { data: any; error: any }

      if (error) {
        request.log.error(error, 'Failed to fetch files for projects')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch projects'
        })
      }

      // 프로젝트별로 그룹화
      const projectsMap = new Map()
      
      files?.forEach((file: any) => {
        const projectName = file.metadata?.project || file.tool_name || 'Unknown Project'
        
        if (!projectsMap.has(projectName)) {
          projectsMap.set(projectName, {
            id: Buffer.from(projectName).toString('base64'), // 임시 ID
            name: projectName,
            description: `${file.tool_name} 세션들`,
            file_count: 0,
            total_size: 0,
            last_updated: file.created_at,
            tool_name: file.tool_name,
          })
        }

        const project = projectsMap.get(projectName)
        project.file_count += 1
        project.total_size += file.file_size || 0
        
        // 가장 최근 업데이트 시간으로 갱신
        if (new Date(file.created_at) > new Date(project.last_updated)) {
          project.last_updated = file.created_at
        }
      })

      const projects = Array.from(projectsMap.values())

      return reply.send({
        success: true,
        data: {
          projects,
          total: projects.length
        }
      })

    } catch (error) {
      request.log.error(error, 'Get projects error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // POST /projects - 새 프로젝트 생성 (placeholder)
  fastify.post('/', async function (request: FastifyRequest, reply) {
    try {
      const projectData = createProjectSchema.parse(request.body)
      
      // 현재는 프로젝트 테이블이 없으므로 placeholder 응답
      const project = {
        id: Buffer.from(projectData.name + Date.now()).toString('base64'),
        name: projectData.name,
        description: projectData.description || null,
        folder_path: projectData.folder_path || null,
        file_count: 0,
        total_size: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }

      return reply.status(201).send({
        success: true,
        message: 'Project concept created (files uploaded with this project name will be grouped)',
        data: project
      })

    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Invalid input',
          details: error.issues
        })
      }

      request.log.error(error, 'Create project error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // GET /projects/{id} - 프로젝트 상세 (세션 목록)
  fastify.get('/:projectId', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { projectId } = request.params as { projectId: string }
      const supabase = getSupabase()

      // projectId를 디코딩해서 프로젝트명 추출
      const projectName = Buffer.from(projectId, 'base64').toString()

      // 해당 프로젝트의 파일들 조회
      const { data: files, error } = await supabase
        .from('uploaded_files')
        .select('*')
        .eq('team_id', user.team_id!)
        .or(`tool_name.eq.${projectName},metadata->>project.eq.${projectName}`)
        .order('created_at', { ascending: false }) as { data: any; error: any }

      if (error) {
        request.log.error(error, 'Failed to fetch project files')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch project details'
        })
      }

      const project = {
        id: projectId,
        name: projectName,
        description: `${files?.[0]?.tool_name || 'AI Tool'} 프로젝트`,
        file_count: files?.length || 0,
        total_size: files?.reduce((sum: number, file: any) => sum + (file.file_size || 0), 0) || 0,
        sessions: files?.map((file: any) => ({
          id: file.id,
          name: file.original_filename,
          tool_name: file.tool_name,
          session_date: file.session_date,
          upload_status: file.upload_status,
          file_size: file.file_size,
          created_at: file.created_at,
        })) || []
      }

      return reply.send({
        success: true,
        data: project
      })

    } catch (error) {
      request.log.error(error, 'Get project details error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // PUT /projects/{id} - 프로젝트 수정 (placeholder)
  fastify.put('/:projectId', async function (request: FastifyRequest, reply) {
    try {
      const { projectId } = request.params as { projectId: string }
      const updates = updateProjectSchema.parse(request.body)
      
      // 현재는 파일의 메타데이터만 업데이트 가능
      return reply.send({
        success: true,
        message: 'Project metadata concept updated',
        data: {
          id: projectId,
          ...updates,
          updated_at: new Date().toISOString(),
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

      request.log.error(error, 'Update project error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // DELETE /projects/{id} - 프로젝트 삭제 (관련 파일들 삭제)
  fastify.delete('/:projectId', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { projectId } = request.params as { projectId: string }
      const supabase = getSupabase()

      const projectName = Buffer.from(projectId, 'base64').toString()

      // 프로젝트 관련 파일들 조회
      const { data: files, error: fetchError } = await supabase
        .from('uploaded_files')
        .select('id, storage_path')
        .eq('team_id', user.team_id!)
        .eq('user_id', user.id) // 본인 파일만 삭제 가능
        .or(`tool_name.eq.${projectName},metadata->>project.eq.${projectName}`) as { data: any; error: any }

      if (fetchError) {
        request.log.error(fetchError, 'Failed to fetch project files for deletion')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch project files'
        })
      }

      if (!files || files.length === 0) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found or no files to delete'
        })
      }

      // Storage에서 파일들 삭제
      const storagePaths = files.map((file: any) => file.storage_path)
      const { error: storageError } = await supabase.storage
        .from('session-files')
        .remove(storagePaths)

      if (storageError) {
        request.log.error(storageError, 'Failed to delete files from storage')
      }

      // 데이터베이스에서 파일들 삭제
      const fileIds = files.map((file: any) => file.id)
      const { error: dbError } = await supabase
        .from('uploaded_files')
        .delete()
        .in('id', fileIds)

      if (dbError) {
        request.log.error(dbError, 'Failed to delete files from database')
        return reply.status(500).send({
          success: false,
          error: 'Failed to delete project files'
        })
      }

      return reply.send({
        success: true,
        message: `Project "${projectName}" and ${files.length} files deleted successfully`
      })

    } catch (error) {
      request.log.error(error, 'Delete project error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // POST /projects/find-or-create - 폴더명 기준 프로젝트 자동 생성/찾기
  fastify.post('/find-or-create', async function (request: FastifyRequest, reply) {
    try {
      const { folder_path, tool_name } = request.body as { folder_path?: string; tool_name?: string }
      
      if (!folder_path && !tool_name) {
        return reply.status(400).send({
          success: false,
          error: 'folder_path or tool_name is required'
        })
      }

      const projectName = folder_path ? 
        folder_path.split('/').pop() || 'Unknown' : 
        tool_name || 'Unknown'

      const project = {
        id: Buffer.from(projectName).toString('base64'),
        name: projectName,
        description: `Auto-created project for ${tool_name || 'AI tool'}`,
        folder_path: folder_path || null,
        tool_name: tool_name || null,
        created_at: new Date().toISOString(),
      }

      return reply.send({
        success: true,
        message: 'Project found/created',
        data: project
      })

    } catch (error) {
      request.log.error(error, 'Find or create project error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })

  // GET /projects/{projectId}/sessions - 프로젝트의 세션 목록
  fastify.get('/:projectId/sessions', async function (request: FastifyRequest, reply) {
    try {
      const user = (request as AuthenticatedRequest).user
      const { projectId } = request.params as { projectId: string }
      const supabase = getSupabase()

      const projectName = Buffer.from(projectId, 'base64').toString()

      const { data: sessions, error } = await supabase
        .from('uploaded_files')
        .select('id, original_filename, tool_name, session_date, upload_status, file_size, created_at')
        .eq('team_id', user.team_id!)
        .or(`tool_name.eq.${projectName},metadata->>project.eq.${projectName}`)
        .order('created_at', { ascending: false }) as { data: any; error: any }

      if (error) {
        request.log.error(error, 'Failed to fetch project sessions')
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch sessions'
        })
      }

      return reply.send({
        success: true,
        data: {
          project_id: projectId,
          project_name: projectName,
          sessions: sessions?.map((session: any) => ({
            id: session.id,
            name: session.original_filename,
            tool_name: session.tool_name,
            session_date: session.session_date,
            upload_status: session.upload_status,
            file_size: session.file_size,
            created_at: session.created_at,
          })) || []
        }
      })

    } catch (error) {
      request.log.error(error, 'Get project sessions error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error'
      })
    }
  })
}