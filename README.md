# VibeReview API

AI 코딩 도구 사용량 분석 및 팀 리뷰 플랫폼의 파일 업로드 API 서버

## 🚀 프로젝트 소개

VibeReview API는 Claude Code, Codex, Gemini CLI 등 AI 코딩 도구의 세션 파일을 업로드하고 메타데이터를 관리하는 REST API 서버입니다. Fastify와 Supabase를 기반으로 구축되었으며, 바이브리뷰 플랫폼의 Bronze Layer(원본 파일 저장)를 담당합니다.

## ✨ 주요 기능

- **파일 업로드**: AI 도구 세션 파일 업로드 (단일/배치)
- **메타데이터 관리**: 파일 목록 조회, 상세 정보, 삭제
- **팀 통계**: 팀별 파일 업로드 및 사용량 통계
- **파일 검증**: MIME 타입, 크기, 해시 기반 중복 제거
- **인증/권한**: JWT 기반 사용자 인증 및 팀별 데이터 격리
- **보안**: CORS, Helmet, Rate Limiting 적용

## 🛠 기술 스택

- **Runtime**: Node.js 18+
- **Framework**: Fastify 4.x
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Storage**: Supabase Storage
- **Authentication**: Supabase Auth (JWT)
- **Validation**: Zod

## 📋 API 엔드포인트

### 파일 업로드
- `POST /api/upload/file` - 단일 파일 업로드
- `POST /api/upload/batch` - 배치 파일 업로드
- `GET /api/upload/status/:fileId` - 업로드 상태 확인

### 메타데이터 관리
- `GET /api/metadata/files` - 파일 목록 조회 (페이지네이션, 필터링)
- `GET /api/metadata/files/:fileId` - 파일 상세 정보
- `DELETE /api/metadata/files/:fileId` - 파일 삭제
- `GET /api/metadata/stats` - 팀 통계
- `GET /api/metadata/files/:fileId/download` - 파일 다운로드

### 헬스체크
- `GET /health` - 서버 상태 확인

## 🚦 빠른 시작

### 1. 의존성 설치
```bash
pnpm install
```

### 2. 환경 변수 설정
```bash
cp .env.example .env
```

`.env` 파일에 필요한 값들을 설정하세요:
```bash
# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here

# 서버
PORT=3001
HOST=localhost
NODE_ENV=development

# 업로드 설정
MAX_FILE_SIZE=52428800  # 50MB
ALLOWED_MIME_TYPES=application/json,application/jsonl,text/plain,text/csv

# 레이트 리미팅
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000  # 15분
```

### 3. 개발 서버 실행
```bash
pnpm dev
```

서버가 `http://localhost:3001`에서 실행됩니다.

## 📝 개발 명령어

```bash
# 개발 서버 실행 (hot reload)
pnpm dev

# TypeScript 타입 체크
pnpm type-check

# 프로덕션 빌드
pnpm build

# 프로덕션 실행
pnpm start

# 테스트 실행
pnpm test

# 테스트 UI
pnpm test:ui
```

## 📁 프로젝트 구조

```
src/
├── index.ts                 # 메인 서버 파일
├── types/
│   ├── env.ts              # 환경변수 타입
│   ├── api.ts              # API 타입 정의
│   └── database.ts         # DB 타입 (Supabase 생성)
├── utils/
│   ├── supabase.ts         # Supabase 클라이언트
│   └── file-validation.ts  # 파일 검증 로직
├── middleware/
│   └── auth.ts             # 인증 미들웨어
└── routes/
    ├── upload/
    │   └── index.ts        # 업로드 라우트
    └── metadata/
        └── index.ts        # 메타데이터 라우트
```

## 🔐 인증 및 권한

### JWT 토큰 사용
모든 API 요청에는 Authorization 헤더가 필요합니다:
```
Authorization: Bearer <jwt_token>
```

### 팀 기반 데이터 격리
- 사용자는 자신이 속한 팀의 데이터만 접근 가능
- 파일 삭제는 업로드한 사용자만 가능

## 📤 파일 업로드 예시

### 단일 파일 업로드
```bash
curl -X POST http://localhost:3001/api/upload/file \
  -H "Authorization: Bearer <jwt_token>" \
  -F "file=@session.jsonl" \
  -F "tool_name=claude-code" \
  -F "session_date=2024-01-01" \
  -F 'metadata={"project":"my-project"}'
```

### 응답 예시
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "original_filename": "session.jsonl",
    "file_size": 1024,
    "tool_name": "claude-code",
    "upload_status": "uploaded",
    "created_at": "2024-01-01T00:00:00Z"
  }
}
```

## 🔍 파일 목록 조회 예시

```bash
curl "http://localhost:3001/api/metadata/files?page=1&limit=20&tool_name=claude-code" \
  -H "Authorization: Bearer <jwt_token>"
```

## 🚨 에러 처리

API는 일관된 에러 응답 형식을 사용합니다:

```json
{
  "success": false,
  "error": "Error message",
  "details": {} // 선택적 상세 정보
}
```

### 주요 HTTP 상태 코드
- `200` - 성공
- `400` - 잘못된 요청 (validation error)
- `401` - 인증 실패
- `403` - 권한 없음
- `404` - 리소스 없음
- `429` - Rate limit 초과
- `500` - 서버 오류

## 🧪 테스트

```bash
# 단위 테스트 실행
pnpm test

# 테스트 UI로 실행
pnpm test:ui

# 커버리지 확인
pnpm test --coverage
```

## 🚀 배포

### 환경별 설정
- **Development**: 로컬 개발 환경
- **Staging**: 스테이징 환경 
- **Production**: 프로덕션 환경

### 배포 준비사항
1. 환경 변수 설정 확인
2. Supabase 프로젝트 연결
3. 데이터베이스 스키마 마이그레이션
4. 프로덕션 빌드

```bash
# 프로덕션 빌드
pnpm build

# 프로덕션 실행
NODE_ENV=production pnpm start
```

## 📊 모니터링

### 헬스체크
```bash
curl http://localhost:3001/health
```

### 로그 모니터링
- 구조화된 JSON 로그 출력
- 에러 레벨별 필터링
- 요청/응답 로깅

## 🤝 기여하기

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 라이센스

이 프로젝트는 MIT 라이센스 하에 있습니다.

## 🔗 관련 링크

- [전체 프로젝트 문서](../CLAUDE.md)
- [Workers 레포지토리](../vibereview-workers/)
- [SQL 스키마 레포지토리](../vibereview-sql/)
- [프론트엔드 레포지토리](../vibereview-web/)

---

VibeReview API 서버 v1.0.0