# VibeReview API Server

Fastify 기반 파일 업로드 및 메타데이터 API 서버

## 프로젝트 개요

바이브리뷰 API는 AI 코딩 도구의 세션 파일을 업로드하고 메타데이터를 관리하는 REST API 서버입니다. Fastify와 Supabase를 기반으로 구축되었으며, Bronze Layer(원본 파일 저장)를 담당합니다.

## 현재 구현 상태

### ✅ 완료된 기능
- [x] Fastify + TypeScript 기본 설정
- [x] Supabase 클라이언트 연동
- [x] JWT 기반 인증 미들웨어
- [x] 파일 업로드 API (`/api/upload/`)
  - [x] 단일 파일 업로드 (중복 파일 upsert 지원)
  - [x] 배치 파일 업로드
  - [x] 업로드 상태 확인
- [x] 메타데이터 API (`/api/metadata/`)
  - [x] 파일 목록 조회 (페이지네이션, 필터링)
  - [x] 파일 상세 정보
  - [x] 파일 삭제
  - [x] 팀 통계
  - [x] 파일 다운로드
- [x] 파일 검증 및 보안
  - [x] MIME 타입 검증
  - [x] 파일 크기 제한
  - [x] 악성 콘텐츠 스캔
  - [x] 파일 해시 기반 중복 제거
- [x] 에러 핸들링 및 로깅
- [x] CORS, 헬멧, 레이트 리미팅

## 남은 작업 (To-Do List)

### 🔧 개발 환경 및 설정

#### 1. Supabase 설정 (Dashboard 방식)
- [ ] Supabase 프로젝트 생성 및 데이터베이스 설정
- [ ] 환경 변수 설정 (URL, Keys)
- [ ] 데이터베이스 스키마 생성 (테이블, RLS 정책)
- [ ] Storage 버킷 생성 및 권한 설정
- [ ] 실제 타입 생성 후 `database.ts` 업데이트

#### 2. 환경 변수 및 설정 개선
- [ ] 환경별 설정 파일 분리 (dev, prod)
- [ ] 더 상세한 환경 변수 검증
- [ ] Docker 컨테이너 설정
- [ ] Health check 엔드포인트 개선 (DB 연결 상태 포함)

### 🛠 기능 개선 및 확장

#### 3. 파일 업로드 개선
- [ ] 업로드 진행률 지원 (WebSocket 또는 Server-Sent Events)
- [ ] 파일 업로드 재개 기능 (chunked upload)
- [ ] 대용량 파일 스트리밍 처리
- [ ] 업로드 큐 관리 (백그라운드 처리)

#### 4. 배치 업로드 완성
- [ ] 배치 업로드 로직 완전 구현
- [ ] 배치 작업 상태 추적
- [ ] 실패한 파일 재시도 메커니즘

#### 5. 파일 검증 강화
- [ ] 파일 내용 기반 AI 도구 자동 감지 개선
- [ ] 세션 파일 구조 검증 (JSONL 형식 등)
- [ ] 바이러스 스캔 통합 (선택사항)

#### 6. 캐싱 시스템
- [ ] Redis 캐싱 레이어 추가
- [ ] 파일 메타데이터 캐싱
- [ ] 통계 데이터 캐싱
- [ ] CDN 통합 (파일 다운로드 최적화)

### 🔒 보안 및 권한

#### 7. 보안 강화
- [ ] API 키 기반 인증 추가 (서버 간 통신용)
- [ ] 세션별 임시 토큰 생성
- [ ] 파일 다운로드 보안 링크 (expire URL)
- [ ] Audit log 시스템

#### 8. 권한 관리 개선
- [ ] 팀 역할별 세부 권한 제어
- [ ] 파일 공유 권한 관리
- [ ] 관리자 전용 API 분리

### 📊 모니터링 및 로깅

#### 9. 로깅 시스템 개선
- [ ] 구조화된 로깅 (JSON 형태)
- [ ] 로그 레벨별 필터링
- [ ] 외부 로그 수집 시스템 연동 (ELK Stack)
- [ ] 에러 트래킹 (Sentry 등)

#### 10. 메트릭스 및 모니터링
- [ ] Prometheus 메트릭스 수집
- [ ] API 성능 모니터링
- [ ] 파일 업로드 통계 수집
- [ ] 알림 시스템 (Slack, Discord 등)

### 🧪 테스트 및 품질

#### 11. 테스트 코드 작성
- [ ] 단위 테스트 (Vitest)
- [ ] 통합 테스트 (API 엔드포인트)
- [ ] 파일 업로드 테스트
- [ ] 성능 테스트 (부하 테스트)

#### 12. 코드 품질 개선
- [ ] ESLint 설정 및 규칙 추가
- [ ] Prettier 코드 포맷팅
- [ ] Pre-commit hooks 설정
- [ ] 타입 커버리지 개선

### 📈 성능 최적화

#### 13. 성능 튜닝
- [ ] 데이터베이스 쿼리 최적화
- [ ] 파일 업로드 성능 개선
- [ ] 메모리 사용량 최적화
- [ ] 응답 시간 개선

#### 14. 확장성 준비
- [ ] 로드 밸런서 지원
- [ ] 서버 클러스터링
- [ ] 데이터베이스 연결 풀 최적화
- [ ] 수평 확장 대비

### 📋 API 문서 및 도구

#### 15. API 문서화
- [ ] OpenAPI (Swagger) 스펙 작성
- [ ] API 문서 자동 생성
- [ ] 예제 요청/응답 추가
- [ ] SDK 생성 (클라이언트 라이브러리)

#### 16. 개발 도구
- [ ] 개발용 파일 업로드 CLI 도구
- [ ] API 테스트용 Postman 컬렉션
- [ ] 개발 환경 Docker Compose

### 🚀 배포 및 운영

#### 17. CI/CD 파이프라인
- [ ] GitHub Actions 설정
- [ ] 자동 테스트 실행
- [ ] 자동 배포 스크립트
- [ ] 환경별 배포 관리

#### 18. 운영 도구
- [ ] 서버 상태 대시보드
- [ ] 데이터베이스 백업 자동화
- [ ] 로그 로테이션 설정
- [ ] 보안 패치 자동화

## Supabase 설정 (Dashboard 방식)

### 1. 프로젝트 생성
1. [Supabase Dashboard](https://supabase.com/dashboard) 접속
2. 새 프로젝트 생성 (Organization: vibereview)
3. 프로젝트명: `vibereview-api`
4. Database 비밀번호 설정 및 저장

### 2. 환경 변수 확인
프로젝트 생성 후 Settings > API에서 다음 정보 확인:
- `SUPABASE_URL`: Project URL
- `SUPABASE_ANON_KEY`: anon/public key  
- `SUPABASE_SERVICE_KEY`: service_role key (서버용)

### 3. 필수 설정 작업
- **데이터베이스 스키마**: 테이블 및 RLS 정책 생성
- **Storage 버킷**: `session-files` 버킷 생성 및 권한 설정
- **Authentication**: 사용자 가입/로그인 설정
- **타입 생성**: SQL Editor에서 스키마 확인 후 TypeScript 타입 생성

## 개발 명령어

```bash
# 개발 서버 실행
pnpm dev

# 타입 체크
pnpm type-check

# 빌드
pnpm build

# 프로덕션 실행
pnpm start

# 테스트 실행
pnpm test

# 테스트 UI
pnpm test:ui
```

## 환경 변수

필수 환경 변수들:

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
MAX_FILE_SIZE=52428800
ALLOWED_MIME_TYPES=application/json,application/jsonl,text/plain,text/csv

# 레이트 리미팅
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000
```

## API 엔드포인트

### 업로드 API
- `POST /api/upload/file` - 단일 파일 업로드
- `POST /api/upload/batch` - 배치 파일 업로드
- `GET /api/upload/status/:fileId` - 업로드 상태 확인

### 메타데이터 API
- `GET /api/metadata/files` - 파일 목록 조회
- `GET /api/metadata/files/:fileId` - 파일 상세 정보
- `DELETE /api/metadata/files/:fileId` - 파일 삭제
- `GET /api/metadata/stats` - 팀 통계
- `GET /api/metadata/files/:fileId/download` - 파일 다운로드

### 헬스체크
- `GET /health` - 서버 상태 확인

## 파일 구조

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

## 우선순위

### High Priority (즉시 필요)
1. **환경 변수 설정 개선** - 프로덕션 배포 준비
2. **데이터베이스 타입 업데이트** - 타입 안정성
3. **테스트 코드 작성** - 안정성 확보
4. **API 문서화** - 개발 효율성

### Medium Priority (단기)
5. **배치 업로드 완성** - 사용자 편의성
6. **파일 검증 강화** - 데이터 품질
7. **캐싱 시스템** - 성능 개선
8. **로깅 개선** - 디버깅 효율성

### Low Priority (장기)
9. **모니터링 시스템** - 운영 안정성
10. **성능 최적화** - 확장성 대비
11. **CI/CD 파이프라인** - 자동화
12. **보안 강화** - 엔터프라이즈 대비

## 관련 문서

- [메인 프로젝트 계획서](../PROJECT_PLAN.md)
- [전체 아키텍처 문서](../CLAUDE.md)
- [Workers 문서](../vibereview-workers/CLAUDE.md)
- [SQL 스키마 문서](../vibereview-sql/CLAUDE.md)