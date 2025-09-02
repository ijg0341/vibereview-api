# API 문서 관리 가이드

## 📚 문서 구조

```
docs/api/
├── README.md          # 이 파일 - 문서 관리 가이드
├── auth.md           # 인증 API (5개)
├── users.md          # 사용자 관리 API (4개)
├── projects.md       # 프로젝트 관리 API (7개)
├── upload.md         # 파일 업로드 API (3개)
├── metadata.md       # 메타데이터 관리 API (5개)
├── api-keys.md       # API 키 관리 API (5개)
├── stats.md          # 통계 API (3개)
└── system.md         # 시스템 API (1개)
```

## 🔄 문서 업데이트 규칙

### ⚠️ API 수정 시 필수 업데이트
API 코드를 수정할 때마다 해당 카테고리의 `.md` 파일도 함께 업데이트해야 합니다:

1. **새 엔드포인트 추가** → 해당 카테고리 `.md` 파일에 문서 추가
2. **요청/응답 형식 변경** → 예시 코드 업데이트
3. **에러 코드 변경** → 에러 응답 예시 업데이트
4. **파라미터 추가/제거** → 요청 파라미터 섹션 업데이트

### 📋 문서 작성 템플릿

각 API 엔드포인트마다 다음 정보를 포함해야 합니다:

```markdown
## 🔗 HTTP_METHOD /api/path
API 설명

### 요청
\`\`\`bash
curl -X METHOD http://localhost:3001/api/path \\
  -H "Authorization: Bearer/ApiKey ..." \\
  -H "Content-Type: application/json" \\
  -d '{"key": "value"}'
\`\`\`

### 요청 본문 (필요시)
\`\`\`json
{
  "key": "value"  // 필수/선택 표시
}
\`\`\`

### 응답 (성공 - 200)
\`\`\`json
{
  "success": true,
  "data": {...}
}
\`\`\`

### 응답 (실패 - 4xx/5xx)
\`\`\`json
{
  "success": false,
  "error": "Error message"
}
\`\`\`
```

## 📊 현재 구현된 API 엔드포인트

### 🔐 인증 API (5개) - `auth.md`
- POST /api/auth/login
- POST /api/auth/signup  
- POST /api/auth/logout
- GET /api/auth/session
- POST /api/auth/callback

### 👤 사용자 관리 API (4개) - `users.md`
- GET /api/users/profile
- PUT /api/users/profile
- GET /api/users/settings
- PUT /api/users/settings

### 📁 프로젝트 관리 API (7개) - `projects.md`
- GET /api/projects
- POST /api/projects
- GET /api/projects/{id}
- PUT /api/projects/{id}
- DELETE /api/projects/{id}
- GET /api/projects/{id}/sessions
- POST /api/projects/find-or-create

### 📤 파일 업로드 API (3개) - `upload.md`
- POST /api/upload/file
- POST /api/upload/batch
- GET /api/upload/status/{fileId}

### 📋 메타데이터 관리 API (5개) - `metadata.md`
- GET /api/metadata/files
- GET /api/metadata/files/{fileId}
- DELETE /api/metadata/files/{fileId}
- GET /api/metadata/stats
- GET /api/metadata/files/{fileId}/download

### 🔑 API 키 관리 API (5개) - `api-keys.md`
- GET /api/api-keys
- POST /api/api-keys
- PUT /api/api-keys/{id}
- DELETE /api/api-keys/{id}
- POST /api/api-keys/verify

### 📊 통계 API (3개) - `stats.md`
- GET /api/stats/dashboard
- GET /api/stats/projects/{id}
- GET /api/stats/users/{id}

### ⚡ 시스템 API (1개) - `system.md`
- GET /health

**총 33개 API 엔드포인트 문서화 완료**

## 🔧 유지보수 체크리스트

### API 수정 시 필수 확인 사항:
- [ ] 해당 카테고리 `.md` 파일 업데이트
- [ ] curl 예시 명령어 테스트
- [ ] 요청/응답 JSON 형식 확인
- [ ] 에러 케이스 문서 업데이트
- [ ] Swagger UI 스키마도 함께 업데이트

### 문서 품질 유지:
- [ ] 실제 동작하는 curl 명령어 제공
- [ ] 현실적인 예시 데이터 사용
- [ ] 한국어 설명 + 영어 필드명
- [ ] 에러 케이스 포괄적 커버