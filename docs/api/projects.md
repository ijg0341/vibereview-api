# 프로젝트 관리 API 문서

## 📋 개요
업로드된 파일들을 프로젝트별로 그룹화하여 관리하는 API들입니다.

---

## 📁 GET /api/projects
프로젝트 목록을 조회합니다. 업로드된 파일들을 기준으로 가상 프로젝트를 생성합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/projects \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "projects": [
      {
        "id": "cHJvamVjdC1uYW1l",  // Base64 인코딩된 프로젝트명
        "name": "claude-code",
        "description": "claude-code 세션들",
        "file_count": 25,
        "total_size": 26214400,
        "last_updated": "2025-01-01T12:00:00Z",
        "tool_name": "claude-code"
      },
      {
        "id": "bXktcHJvamVjdA==",
        "name": "my-project",
        "description": "github-codex 세션들",
        "file_count": 12,
        "total_size": 12582912,
        "last_updated": "2025-01-01T10:00:00Z",
        "tool_name": "github-codex"
      }
    ],
    "total": 2
  }
}
```

---

## ➕ POST /api/projects
새로운 프로젝트 개념을 생성합니다.

### 요청
```bash
curl -X POST http://localhost:3001/api/projects \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Project",
    "description": "새 프로젝트 설명",
    "folder_path": "/Users/user/projects/new-project"
  }'
```

### 요청 본문
```json
{
  "name": "New Project",        // 필수: 프로젝트명
  "description": "새 프로젝트 설명",  // 선택사항
  "folder_path": "/Users/user/projects/new-project"  // 선택사항
}
```

### 응답 (성공 - 201)
```json
{
  "success": true,
  "message": "Project concept created (files uploaded with this project name will be grouped)",
  "data": {
    "id": "TmV3IFByb2plY3Q=",
    "name": "New Project",
    "description": "새 프로젝트 설명",
    "folder_path": "/Users/user/projects/new-project",
    "file_count": 0,
    "total_size": 0,
    "created_at": "2025-01-01T12:00:00Z",
    "updated_at": "2025-01-01T12:00:00Z"
  }
}
```

---

## 🔍 GET /api/projects/{projectId}
프로젝트 상세 정보와 세션 목록을 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/projects/cHJvamVjdC1uYW1l \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "id": "cHJvamVjdC1uYW1l",
    "name": "project-name",
    "description": "AI Tool 프로젝트",
    "file_count": 15,
    "total_size": 15728640,
    "sessions": [
      {
        "id": "session-file-uuid",
        "name": "session-20250101.jsonl",
        "tool_name": "claude-code",
        "session_date": "2025-01-01",
        "upload_status": "processed",
        "file_size": 1048576,
        "created_at": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

## ✏️ PUT /api/projects/{projectId}
프로젝트 정보를 수정합니다.

### 요청
```bash
curl -X PUT http://localhost:3001/api/projects/cHJvamVjdC1uYW1l \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Project Name",
    "description": "수정된 설명"
  }'
```

### 요청 본문
```json
{
  "name": "Updated Project Name",  // 선택사항
  "description": "수정된 설명",       // 선택사항
  "folder_path": "/new/path"       // 선택사항
}
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "message": "Project metadata concept updated",
  "data": {
    "id": "cHJvamVjdC1uYW1l",
    "name": "Updated Project Name",
    "description": "수정된 설명",
    "folder_path": "/new/path",
    "updated_at": "2025-01-01T12:30:00Z"
  }
}
```

---

## 🗑️ DELETE /api/projects/{projectId}
프로젝트와 관련된 모든 파일을 삭제합니다.

### 요청
```bash
curl -X DELETE http://localhost:3001/api/projects/cHJvamVjdC1uYW1l \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "message": "Project \"project-name\" and 15 files deleted successfully"
}
```

---

## 📝 GET /api/projects/{projectId}/sessions
프로젝트의 세션 목록을 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/projects/cHJvamVjdC1uYW1l/sessions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "project_id": "cHJvamVjdC1uYW1l",
    "project_name": "project-name",
    "sessions": [
      {
        "id": "session-uuid",
        "name": "session-20250101.jsonl",
        "tool_name": "claude-code",
        "session_date": "2025-01-01",
        "upload_status": "processed",
        "file_size": 1048576,
        "created_at": "2025-01-01T00:00:00Z"
      }
    ]
  }
}
```

---

## 🔄 POST /api/projects/find-or-create
폴더 경로나 도구명을 기준으로 프로젝트를 자동으로 찾거나 생성합니다.

### 요청
```bash
curl -X POST http://localhost:3001/api/projects/find-or-create \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "folder_path": "/Users/user/my-project",
    "tool_name": "claude-code"
  }'
```

### 요청 본문
```json
{
  "folder_path": "/Users/user/my-project",  // 선택사항
  "tool_name": "claude-code"               // 선택사항
}
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "message": "Project found/created",
  "data": {
    "id": "bXktcHJvamVjdA==",
    "name": "my-project",
    "description": "Auto-created project for claude-code",
    "folder_path": "/Users/user/my-project",
    "tool_name": "claude-code",
    "created_at": "2025-01-01T12:00:00Z"
  }
}
```

---

## 🚨 공통 에러 응답

### 잘못된 입력 (400)
```json
{
  "success": false,
  "error": "folder_path or tool_name is required"
}
```

### 프로젝트 없음 (404)
```json
{
  "success": false,
  "error": "Project not found or no files to delete"
}
```

### 권한 없음 (403)
```json
{
  "success": false,
  "error": "User must be part of a team"
}
```