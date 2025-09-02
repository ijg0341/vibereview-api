import 'dotenv/config'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import { validateEnv } from './types/env.js'
import { initSupabase } from './utils/supabase.js'
import { swaggerOptions, swaggerUiOptions } from './swagger.js'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Import routes
import authRoutes from './routes/auth/index.js'
import userRoutes from './routes/users/index.js'
import projectRoutes from './routes/projects/index.js'
import statsRoutes from './routes/stats/index.js'
import apiKeyRoutes from './routes/api-keys/index.js'
import uploadRoutes from './routes/upload/index.js'
import metadataRoutes from './routes/metadata/index.js'

const env = validateEnv()
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const fastify = Fastify({
  logger: {
    level: env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
})

// Initialize Supabase
initSupabase(env)

// Register Swagger
await fastify.register(swagger, swaggerOptions)
await fastify.register(swaggerUi, swaggerUiOptions)

// Register plugins
await fastify.register(helmet, {
  contentSecurityPolicy: false, // Disable CSP for API and Swagger
})

await fastify.register(cors, {
  origin: env.NODE_ENV === 'development' 
    ? ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']
    : [
        'https://vibe-review.vercel.app',
        /\.railway\.app$/,
        /\.vercel\.app$/
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
})

await fastify.register(rateLimit, {
  max: env.RATE_LIMIT_MAX,
  timeWindow: env.RATE_LIMIT_WINDOW,
  errorResponseBuilder: () => ({
    success: false,
    error: 'Rate limit exceeded. Please try again later.',
  }),
})

await fastify.register(multipart, {
  limits: {
    fileSize: env.MAX_FILE_SIZE,
    files: 1, // Only allow one file per request
  },
})

// Register static files (테스트 페이지)
await fastify.register(fastifyStatic, {
  root: join(__dirname, '..', 'public'),
  prefix: '/test/',
})

// Health check
fastify.get('/health', {
  schema: {
    tags: ['System'],
    summary: '서버 상태 확인',
    description: 'API 서버의 상태와 버전 정보를 확인합니다',
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean', description: '성공 여부' },
          message: { type: 'string', description: '상태 메시지' },
          timestamp: { type: 'string', description: '현재 시간' },
          version: { type: 'string', description: 'API 버전' }
        }
      }
    }
  }
}, async () => {
  return { 
    success: true,
    message: 'VibeReview API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  }
})

// Register routes
await fastify.register(authRoutes, { prefix: '/api/auth' })
await fastify.register(userRoutes, { prefix: '/api/users' })
await fastify.register(projectRoutes, { prefix: '/api/projects' })
await fastify.register(statsRoutes, { prefix: '/api/stats' })
await fastify.register(apiKeyRoutes, { prefix: '/api/api-keys' })
await fastify.register(uploadRoutes, { prefix: '/api/upload' })
await fastify.register(metadataRoutes, { prefix: '/api/metadata' })

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  request.log.error(error, 'Unhandled error')
  
  const statusCode = error.statusCode || 500
  const message = statusCode >= 500 
    ? 'Internal server error' 
    : error.message || 'An error occurred'
  
  reply.status(statusCode).send({
    success: false,
    error: message,
  })
})

// Not found handler
fastify.setNotFoundHandler((_request, reply) => {
  reply.status(404).send({
    success: false,
    error: 'Route not found',
  })
})

// Start server
const start = async () => {
  try {
    await fastify.listen({ 
      port: env.PORT, 
      host: env.NODE_ENV === 'production' ? '0.0.0.0' : env.HOST 
    })
    
    fastify.log.info(`🚀 VibeReview API running on http://${env.HOST}:${env.PORT}`)
    fastify.log.info(`📊 Environment: ${env.NODE_ENV}`)
    fastify.log.info(`🔒 Rate limit: ${env.RATE_LIMIT_MAX} requests per ${env.RATE_LIMIT_WINDOW}ms`)
    fastify.log.info(`📁 Max file size: ${Math.round(env.MAX_FILE_SIZE / 1024 / 1024)}MB`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  fastify.log.info('Received SIGINT, shutting down gracefully...')
  await fastify.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  fastify.log.info('Received SIGTERM, shutting down gracefully...')
  await fastify.close()
  process.exit(0)
})

start()