# 사용자 관리 API 문서

## 📋 개요
사용자 프로필과 설정을 관리하는 API들입니다. 모든 엔드포인트는 JWT 토큰 또는 API 키 인증이 필요합니다.

---

## 👤 GET /api/users/profile
현재 로그인한 사용자의 프로필 정보를 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "id": "6377de8a-43a8-43ba-90f9-4099f3f096d5",
    "email": "user@example.com",
    "profile": {
      "full_name": "사용자 이름",
      "username": "myusername",
      "avatar_url": "https://example.com/avatar.jpg",
      "role": "member",
      "team_id": "team-uuid",
      "is_active": true,
      "created_at": "2025-01-01T00:00:00Z",
      "updated_at": "2025-01-01T00:00:00Z"
    }
  }
}
```

---

## ✏️ PUT /api/users/profile
사용자 프로필 정보를 수정합니다.

### 요청
```bash
curl -X PUT http://localhost:3001/api/users/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "full_name": "새 이름",
    "username": "newusername",
    "avatar_url": "https://example.com/new-avatar.jpg"
  }'
```

### 요청 본문
```json
{
  "full_name": "새 이름",      // 선택사항
  "username": "newusername",   // 선택사항
  "avatar_url": "https://example.com/new-avatar.jpg"  // 선택사항
}
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "message": "Profile updated successfully",
  "data": {
    "id": "user-uuid",
    "team_id": "team-uuid",
    "full_name": "새 이름",
    "username": "newusername",
    "avatar_url": "https://example.com/new-avatar.jpg",
    "role": "member",
    "is_active": true,
    "updated_at": "2025-01-01T12:30:00Z"
  }
}
```

---

## ⚙️ GET /api/users/settings
사용자의 개인 설정을 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/users/settings \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "language": "ko",
    "work_directory": null,
    "notifications_enabled": true,
    "timezone": "Asia/Seoul",
    "theme": "light",
    "file_auto_detection": true
  }
}
```

---

## 🔧 PUT /api/users/settings
사용자의 개인 설정을 변경합니다.

### 요청
```bash
curl -X PUT http://localhost:3001/api/users/settings \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "language": "en",
    "work_directory": "/Users/user/projects",
    "notifications_enabled": false,
    "timezone": "America/New_York"
  }'
```

### 요청 본문
```json
{
  "language": "en",                           // 선택사항 (ko, en)
  "work_directory": "/Users/user/projects",   // 선택사항
  "notifications_enabled": false,             // 선택사항
  "timezone": "America/New_York"              // 선택사항
}
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": {
    "language": "en",
    "work_directory": "/Users/user/projects",
    "notifications_enabled": false,
    "timezone": "America/New_York"
  }
}
```

---

## 🚨 공통 에러 응답

### 인증 실패 (401)
```json
{
  "success": false,
  "error": "Missing authorization header"
}
```

### 권한 없음 (403)
```json
{
  "success": false,
  "error": "User must be part of a team"
}
```

### 잘못된 입력 (400)
```json
{
  "success": false,
  "error": "Invalid input",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "path": ["full_name"],
      "message": "Expected string, received undefined"
    }
  ]
}
```

### 서버 에러 (500)
```json
{
  "success": false,
  "error": "Internal server error"
}
```