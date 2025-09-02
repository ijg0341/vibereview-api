// Swagger 설정을 별도 파일로 분리
export const swaggerOptions = {
  swagger: {
    info: {
      title: 'VibeReview API',
      description: 'AI 코딩 도구 사용량 분석 및 팀 리뷰 플랫폼 API',
      version: '1.0.0'
    },
    host: 'localhost:3001',
    schemes: ['http'],
    consumes: ['application/json', 'multipart/form-data'],
    produces: ['application/json'],
    securityDefinitions: {
      bearerAuth: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
        description: 'JWT 토큰을 "Bearer {token}" 형식으로 입력'
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: '인증 관련 API'
      },
      {
        name: 'Users',
        description: '사용자 관리 API'
      },
      {
        name: 'Projects',
        description: '프로젝트 관리 API'
      },
      {
        name: 'Upload',
        description: '파일 업로드 API'
      },
      {
        name: 'Metadata',
        description: '메타데이터 관리 API'
      },
      {
        name: 'Stats',
        description: '통계 및 대시보드 API'
      }
    ]
  }
}

export const swaggerUiOptions = {
  routePrefix: '/docs',
  exposeRoute: true,
  staticCSP: true,
  openapi: {
    info: {
      title: 'VibeReview API Documentation',
      version: '1.0.0'
    }
  }
}