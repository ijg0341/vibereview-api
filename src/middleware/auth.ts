import type { FastifyRequest, FastifyReply } from 'fastify'
import { getSupabase } from '../utils/supabase.js'

export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string
    email: string | undefined
    team_id: string | undefined
    role: string | undefined
  }
}

export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        success: false,
        error: 'Missing or invalid authorization header'
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const supabase = getSupabase()

    // Verify JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return reply.status(401).send({
        success: false,
        error: 'Invalid or expired token'
      })
    }

    // Get user profile with team information
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