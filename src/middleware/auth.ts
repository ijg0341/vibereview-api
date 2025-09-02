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
      const { data: profile, error: profileError } = await supabase
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
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', matchingKey.user_id)
        .maybeSingle() as { data: { role: 'admin' | 'member' } | null; error: any }

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
        team_id: matchingKey.team_id,
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