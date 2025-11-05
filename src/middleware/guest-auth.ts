import type { FastifyRequest, FastifyReply } from 'fastify'
import { getSupabase } from '../utils/supabase.js'
import { authMiddleware, type AuthenticatedRequest } from './auth.js'

export interface GuestUser {
  id: string
  email: string
  full_name: string
}

export interface GuestAuthenticatedRequest extends FastifyRequest {
  user?: AuthenticatedRequest['user']
  guestUser?: GuestUser
  auth_method?: 'jwt' | 'apikey' | 'guest'
}

/**
 * 게스트 또는 정회원 인증을 지원하는 미들웨어
 * X-Guest-User-Id 헤더가 있으면 게스트 모드, 없으면 정회원 모드
 */
export async function guestOrUserAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const guestUserId = request.headers['x-guest-user-id'] as string | undefined

  if (guestUserId) {
    // 게스트 모드
    try {
      const supabase = getSupabase()

      const { data: guestUser, error } = await supabase
        .from('guest_users')
        .select('id, email, full_name')
        .eq('id', guestUserId)
        .maybeSingle() as { data: GuestUser | null; error: any }

      if (error || !guestUser) {
        return reply.status(401).send({
          success: false,
          error: 'Invalid guest user ID'
        })
      }

      // Attach guest user info to request
      ;(request as GuestAuthenticatedRequest).guestUser = guestUser
      ;(request as GuestAuthenticatedRequest).auth_method = 'guest'

      request.log.info({ guestUserId: guestUser.id, email: guestUser.email }, 'Guest authentication successful')
    } catch (error) {
      request.log.error(error, 'Guest authentication error')
      return reply.status(500).send({
        success: false,
        error: 'Internal server error during guest authentication'
      })
    }
  } else {
    // 정회원 모드 - 기존 인증 미들웨어 사용
    await authMiddleware(request, reply)
  }
}
