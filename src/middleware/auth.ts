import type { FastifyRequest, FastifyReply } from 'fastify'
import { getSupabase } from '../utils/supabase.js'
import { extractAuthType, verifyApiKey } from '../utils/api-keys.js'

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string
    email: string | undefined
    team_id: string | undefined
    role: string | undefined
  }
  auth_method?: 'jwt' | 'apikey'
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({
        success: false,
        error: 'Missing authorization header'
      })
    }

    const authInfo = extractAuthType(authHeader)
    if (!authInfo) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid authorization format. Use "Bearer {jwt_token}" or "ApiKey {api_key}"'
      })
    }

    const supabase = getSupabase()

    if (authInfo.type === 'jwt') {
      // JWT 토큰 검증
      const { data: { user }, error } = await supabase.auth.getUser(authInfo.token)
      if (error || !user) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid or expired JWT token'
        })
      }

      // Get user profile
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('team_id, role')
        .eq('id', user.id)
        .maybeSingle() as { data: { team_id: string | null; role: 'admin' | 'member' } | null; error: any }

      if (profileError) {
        return reply.status(500).send({
          success: false,
          error: 'Failed to fetch user profile'
        })
      }

      // 프로필이 없거나 팀이 없으면 기본 설정 생성
      if (!profile || !profile.team_id) {
        await ensureUserHasTeam(supabase, user, profile)
        
        // 다시 프로필 조회
        const { data: updatedProfile } = await supabase
          .from('profiles')
          .select('team_id, role')
          .eq('id', user.id)
          .maybeSingle() as { data: { team_id: string | null; role: 'admin' | 'member' } | null; error: any }
        
        profile = updatedProfile
      }

      // Attach user info to request
      ;(request as AuthenticatedRequest).user = {
        id: user.id,
        email: user.email || undefined,
        team_id: profile?.team_id || undefined,
        role: profile?.role || undefined,
      }
      ;(request as AuthenticatedRequest).auth_method = 'jwt'

    } else if (authInfo.type === 'apikey') {
      // API 키 검증
      const { data: apiKeys, error: keysError } = await supabase
        .from('api_keys')
        .select('id, user_id, team_id, name, key_hash, is_active, expires_at')
        .eq('is_active', true) as { data: any; error: any }

      if (keysError) {
        request.log.error(keysError, 'Failed to fetch API keys')
        return reply.status(500).send({
          success: false,
          error: 'Authentication error'
        })
      }

      // 해시 검증
      const matchingKey = apiKeys?.find((key: any) => verifyApiKey(authInfo.token, key.key_hash))

      if (!matchingKey) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid API key'
        })
      }

      // 만료일 확인
      const now = new Date()
      if (matchingKey.expires_at && new Date(matchingKey.expires_at) < now) {
        return reply.status(401).send({
          success: false,
          error: 'API key has expired'
        })
      }

      // 사용자 프로필 조회
      let { data: profile } = await supabase
        .from('profiles')
        .select('role, team_id')
        .eq('id', matchingKey.user_id)
        .maybeSingle() as { data: { role: 'admin' | 'member'; team_id: string | null } | null; error: any }
        
      // 프로필이 없거나 팀이 없으면 기본 설정 생성
      if (!profile || !profile.team_id) {
        const userData = { id: matchingKey.user_id, email: undefined }
        await ensureUserHasTeam(supabase, userData, profile)
        
        // 다시 프로필 조회
        const { data: updatedProfile } = await supabase
          .from('profiles')
          .select('role, team_id')
          .eq('id', matchingKey.user_id)
          .maybeSingle() as { data: { role: 'admin' | 'member'; team_id: string | null } | null; error: any }
        
        profile = updatedProfile
      }

      // 마지막 사용 시간 업데이트 (백그라운드)
      ;(supabase as any)
        .from('api_keys')
        .update({ last_used_at: now.toISOString() })
        .eq('id', matchingKey.id)
        .then(() => {})
        .catch(() => {})

      // Attach user info to request  
      ;(request as AuthenticatedRequest).user = {
        id: matchingKey.user_id,
        email: undefined, // API 키로는 이메일 정보 없음
        team_id: profile?.team_id || undefined,
        role: profile?.role || undefined,
      }
      ;(request as AuthenticatedRequest).auth_method = 'apikey'
    }

  } catch (error) {
    request.log.error(error, 'Authentication error')
    return reply.status(500).send({
      success: false,
      error: 'Internal server error during authentication'
    })
  }
}

export function requireTeam() {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user
    if (!user?.team_id) {
      return reply.status(403).send({
        success: false,
        error: 'User must be part of a team'
      })
    }
  }
}

export function requireRole(role: 'admin' | 'member') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as AuthenticatedRequest).user
    if (!user?.role || user.role !== role) {
      return reply.status(403).send({
        success: false,
        error: `Requires ${role} role`
      })
    }
  }
}

// 사용자에게 팀이 없으면 기본 팀 생성/배정
async function ensureUserHasTeam(supabase: any, user: any, profile: any) {
  try {
    // 1. 기본 팀 조회 또는 생성
    let { data: defaultTeam } = await supabase
      .from('teams')
      .select('id')
      .eq('slug', 'default-team')
      .maybeSingle()

    if (!defaultTeam) {
      // 기본 팀 생성
      const { data: newTeam } = await supabase
        .from('teams')
        .insert({
          name: 'Default Team',
          slug: 'default-team',
          description: 'Auto-generated default team'
        })
        .select()
        .single()
      
      defaultTeam = newTeam
    }

    // 2. 프로필이 없으면 생성, 있으면 팀 배정
    if (!profile) {
      // 새 프로필 생성
      await supabase
        .from('profiles')
        .insert({
          id: user.id,
          team_id: defaultTeam.id,
          role: 'member',
          is_active: true,
        })
    } else {
      // 기존 프로필에 팀 배정
      await supabase
        .from('profiles')
        .update({
          team_id: defaultTeam.id,
          role: profile.role || 'member'
        })
        .eq('id', user.id)
    }

    return defaultTeam.id
    
  } catch (error) {
    console.error('Failed to ensure user has team:', error)
    throw error
  }
}