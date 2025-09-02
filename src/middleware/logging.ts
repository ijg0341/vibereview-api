import type { FastifyRequest, FastifyReply } from 'fastify'

// API 요청/응답 상세 로깅 미들웨어
export async function apiLoggingMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const startTime = Date.now()
  
  // 요청 로그
  request.log.info({
    type: 'request',
    method: request.method,
    url: request.url,
    headers: {
      'content-type': request.headers['content-type'],
      'user-agent': request.headers['user-agent'],
      'authorization': request.headers.authorization ? 
        `${request.headers.authorization.split(' ')[0]} ***` : undefined
    },
    query: request.query,
    body: request.method !== 'GET' ? 
      (request.body && Object.keys(request.body).length > 0 ? '[BODY_PRESENT]' : '[NO_BODY]') 
      : undefined
  }, 'API Request')

  // 응답 후크로 응답 로그
  reply.raw.on('finish', () => {
    const duration = Date.now() - startTime
    
    request.log.info({
      type: 'response',
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration: `${duration}ms`
    }, 'API Response')
  })
}