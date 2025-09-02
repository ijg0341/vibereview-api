# 통계 API 문서

## 📋 개요
팀, 프로젝트, 사용자별 통계 정보를 제공하는 API들입니다.

---

## 📊 GET /api/stats/dashboard
메인 대시보드에 표시할 전체 통계를 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/stats/dashboard \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_projects": 12,
      "total_files": 342,
      "total_size": 157286400,  // bytes
      "team_members": 5,
      "recent_activity": 28  // 최근 7일간 업로드 수
    },
    "tool_usage": {
      "claude-code": {
        "count": 200,
        "size": 104857600
      },
      "github-codex": {
        "count": 100,
        "size": 41943040
      },
      "gemini-cli": {
        "count": 42,
        "size": 10485760
      }
    },
    "recent_uploads": [
      {
        "id": "recent-file-uuid",
        "filename": "latest-session.jsonl",
        "tool_name": "claude-code",
        "uploaded_at": "2025-01-01T12:00:00Z",
        "file_size": 1024576
      }
    ],
    "upload_trends": {
      "daily": {
        "2025-01-01": { "count": 5, "size": 5242880 },
        "2024-12-31": { "count": 3, "size": 3145728 },
        "2024-12-30": { "count": 8, "size": 8388608 }
      }
    }
  }
}
```

---

## 📁 GET /api/stats/projects/{projectId}
특정 프로젝트의 상세 통계를 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/stats/projects/cHJvamVjdC1uYW1l \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### URL 파라미터
- `projectId`: Base64 인코딩된 프로젝트 이름

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "project": {
      "id": "cHJvamVjdC1uYW1l",
      "name": "my-project",
      "total_files": 25,
      "total_size": 26214400
    },
    "member_contributions": {
      "user-uuid-1": {
        "count": 15,
        "size": 15728640
      },
      "user-uuid-2": {
        "count": 10,
        "size": 10485760
      }
    },
    "upload_trends": {
      "daily": {
        "2025-01-01": { "count": 2, "size": 2097152 },
        "2024-12-31": { "count": 1, "size": 1048576 }
      }
    },
    "file_types": {
      "jsonl": 20,
      "json": 4,
      "csv": 1
    }
  }
}
```

---

## 👤 GET /api/stats/users/{userId}
특정 사용자의 활동 통계를 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/stats/users/user-uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "user_id": "user-uuid",
    "activity": {
      "total_files": 85,
      "total_size": 89478400,
      "projects_count": 7
    },
    "upload_trends": {
      "daily": {
        "2025-01-01": { "count": 3, "size": 3145728 },
        "2024-12-31": { "count": 2, "size": 2097152 }
      }
    },
    "tool_preferences": {
      "claude-code": 60,
      "github-codex": 20,
      "cursor": 5
    }
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

### 프로젝트/사용자 없음 (404)
```json
{
  "success": false,
  "error": "Project not found"
}
```

### 서버 에러 (500)
```json
{
  "success": false,
  "error": "Failed to fetch statistics"
}
```