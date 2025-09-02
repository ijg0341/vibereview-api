# 인증 API 문서

## 📋 개요
사용자 인증(로그인, 회원가입, 로그아웃, 세션 관리)을 담당하는 API들입니다.

---

## 🔐 POST /api/auth/login
이메일과 비밀번호로 로그인하여 JWT 토큰을 받습니다.

### 요청
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### 요청 본문
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6377de8a-43a8-43ba-90f9-4099f3f096d5",
      "email": "user@example.com",
      "created_at": "2025-01-01T00:00:00Z",
      "email_confirmed_at": "2025-01-01T00:00:00Z",
      "user_metadata": {
        "email": "user@example.com",
        "full_name": "User Name"
      }
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "refresh_token": "refresh_token_here",
      "expires_in": 3600,
      "token_type": "bearer"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "refresh_token_here"
  }
}
```

### 응답 (실패 - 401)
```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

## 🆕 POST /api/auth/signup
새 계정을 생성합니다. 이메일 인증 없이 즉시 활성화됩니다.

### 요청
```bash
curl -X POST http://localhost:3001/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123",
    "full_name": "New User"
  }'
```

### 요청 본문
```json
{
  "email": "newuser@example.com",
  "password": "password123",
  "full_name": "New User"  // 선택사항
}
```

### 응답 (성공 - 201)
```json
{
  "success": true,
  "message": "User created successfully. Account is ready to use.",
  "data": {
    "user": {
      "id": "new-user-uuid",
      "email": "newuser@example.com",
      "created_at": "2025-01-01T00:00:00Z",
      "user_metadata": {
        "full_name": "New User"
      }
    },
    "session": {
      "access_token": "eyJhbGciOiJIUzI1NiIs...",
      "refresh_token": "refresh_token_here",
      "expires_in": 3600,
      "token_type": "bearer"
    },
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "refresh_token_here"
  }
}
```

---

## 🚪 POST /api/auth/logout
JWT 토큰을 무효화하여 로그아웃합니다.

### 요청
```bash
curl -X POST http://localhost:3001/api/auth/logout \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 👤 GET /api/auth/session
현재 로그인 상태와 사용자 정보를 확인합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/auth/session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6377de8a-43a8-43ba-90f9-4099f3f096d5",
      "email": "user@example.com",
      "team_id": "team-uuid",
      "role": "member",
      "created_at": "2025-01-01T00:00:00Z",
      "profile": {
        "full_name": "User Name",
        "username": null,
        "avatar_url": null,
        "is_active": true
      }
    },
    "auth_method": "jwt"
  }
}
```

### API 키로 세션 확인
```bash
curl -X GET http://localhost:3001/api/auth/session \
  -H "Authorization: ApiKey vr_abcd1234efgh5678..."
```

### 응답 (API 키 - 200)
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": null,  // API 키로는 이메일 정보 없음
      "team_id": "team-uuid",
      "role": "member"
    },
    "auth_method": "apikey"
  }
}
```

---

## 🔗 POST /api/auth/callback
OAuth 콜백 처리 (현재 미구현)

### 응답 (501)
```json
{
  "success": false,
  "error": "OAuth callback not implemented yet"
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

### 잘못된 입력 (400)
```json
{
  "success": false,
  "error": "Invalid input",
  "details": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["email"],
      "message": "Required"
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