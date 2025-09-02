# API 키 관리 문서

## 📋 개요
CLI나 외부 도구에서 사용할 API 키를 관리하는 API들입니다. JWT 토큰 인증이 필요합니다.

---

## 🔑 GET /api/api-keys
내가 생성한 API 키 목록을 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/api-keys \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": [
    {
      "id": "api-key-uuid",
      "name": "CLI Upload Key",
      "key_preview": "vr_**********************abc1",
      "is_active": true,
      "last_used_at": "2025-01-01T12:00:00Z",
      "expires_at": "2025-02-01T00:00:00Z",
      "created_at": "2025-01-01T00:00:00Z"
    },
    {
      "id": "api-key-uuid-2",
      "name": "Backup Key",
      "key_preview": "vr_**********************def2",
      "is_active": false,
      "last_used_at": null,
      "expires_at": null,  // 무제한
      "created_at": "2024-12-15T00:00:00Z"
    }
  ]
}
```

---

## ➕ POST /api/api-keys
새 API 키를 생성합니다. 키는 생성 시 한 번만 표시됩니다.

### 요청
```bash
curl -X POST http://localhost:3001/api/api-keys \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New CLI Key",
    "expires_days": 30
  }'
```

### 요청 본문
```json
{
  "name": "New CLI Key",    // 필수: API 키 이름
  "expires_days": 30        // 선택: 만료일 (1-365일)
}
```

### 응답 (성공 - 201)
```json
{
  "success": true,
  "message": "API key created successfully. Please save it safely - it will not be shown again.",
  "data": {
    "id": "new-key-uuid",
    "name": "New CLI Key",
    "api_key": "vr_abcd1234efgh5678ijkl9012mnop3456",  // ⚠️ 한 번만 표시
    "key_preview": "vr_**********************3456",
    "expires_at": "2025-02-01T00:00:00Z",
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

## ✏️ PUT /api/api-keys/{id}
API 키의 이름이나 활성화 상태를 변경합니다.

### 요청
```bash
curl -X PUT http://localhost:3001/api/api-keys/api-key-uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Key Name",
    "is_active": false
  }'
```

### 요청 본문
```json
{
  "name": "Updated Key Name",  // 선택사항
  "is_active": false          // 선택사항
}
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "message": "API key updated successfully",
  "data": {
    "id": "api-key-uuid",
    "name": "Updated Key Name",
    "key_preview": "vr_**********************abc1",
    "is_active": false,
    "expires_at": "2025-02-01T00:00:00Z",
    "updated_at": "2025-01-01T12:30:00Z"
  }
}
```

---

## 🗑️ DELETE /api/api-keys/{id}
API 키를 완전히 삭제합니다.

### 요청
```bash
curl -X DELETE http://localhost:3001/api/api-keys/api-key-uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "message": "API key \"CLI Upload Key\" deleted successfully"
}
```

---

## ✅ POST /api/api-keys/verify
CLI나 외부 도구에서 API 키의 유효성을 검증합니다. **인증 토큰 없이 호출 가능합니다.**

### 요청 (인증 불필요)
```bash
curl -X POST http://localhost:3001/api/api-keys/verify \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "vr_abcd1234efgh5678ijkl9012mnop3456"
  }'
```

### 요청 본문
```json
{
  "api_key": "vr_abcd1234efgh5678ijkl9012mnop3456"
}
```

### 응답 (유효한 키 - 200)
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user_id": "user-uuid",
    "team_id": "team-uuid",
    "name": "CLI Upload Key",
    "expires_at": "2025-02-01T00:00:00Z"
  }
}
```

### 응답 (유효하지 않은 키 - 200)
```json
{
  "success": true,
  "data": {
    "valid": false,
    "message": "Invalid or inactive API key"
  }
}
```

### 응답 (만료된 키 - 200)
```json
{
  "success": true,
  "data": {
    "valid": false,
    "message": "API key has expired"
  }
}
```

---

## 🚨 공통 에러 응답

### 잘못된 키 형식 (400)
```json
{
  "success": false,
  "error": "Invalid input",
  "details": [
    {
      "code": "custom",
      "message": "Invalid API key format",
      "path": ["api_key"]
    }
  ]
}
```

### 키 없음 (404)
```json
{
  "success": false,
  "error": "API key not found"
}
```