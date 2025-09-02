# 메타데이터 관리 API 문서

## 📋 개요
업로드된 파일의 메타데이터를 조회, 관리, 다운로드하는 API들입니다.

---

## 📋 GET /api/metadata/files
업로드된 파일 목록을 페이지네이션과 필터링으로 조회합니다.

### 요청
```bash
curl -X GET "http://localhost:3001/api/metadata/files?page=1&limit=20&tool_name=claude-code&status=uploaded" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 쿼리 파라미터
- `page` (선택): 페이지 번호 (기본: 1)
- `limit` (선택): 페이지당 항목 수 (기본: 20, 최대: 100)
- `tool_name` (선택): AI 도구명으로 필터링
- `status` (선택): 상태 필터 (uploaded, processing, processed, failed)
- `search` (선택): 파일명 검색
- `sort` (선택): 정렬 기준 (created_at, file_size, original_filename)
- `order` (선택): 정렬 순서 (asc, desc)

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "files": [
      {
        "id": "file-uuid",
        "original_filename": "session.jsonl",
        "file_size": 1024576,
        "mime_type": "application/jsonl",
        "tool_name": "claude-code",
        "session_date": "2025-01-01",
        "upload_status": "processed",
        "processing_error": null,
        "metadata": {
          "project": "my-project"
        },
        "created_at": "2025-01-01T00:00:00Z",
        "updated_at": "2025-01-01T01:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "total_pages": 3,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

---

## 🔍 GET /api/metadata/files/{fileId}
특정 파일의 상세 정보를 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/metadata/files/file-uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "id": "file-uuid",
    "team_id": "team-uuid",
    "user_id": "user-uuid",
    "original_filename": "session.jsonl",
    "storage_path": "team-uuid/user-uuid/hash.jsonl",
    "file_size": 1024576,
    "mime_type": "application/jsonl",
    "file_hash": "sha256-hash",
    "tool_name": "claude-code",
    "session_date": "2025-01-01",
    "upload_status": "processed",
    "processing_error": null,
    "metadata": {
      "project": "my-project",
      "version": "1.0"
    },
    "created_at": "2025-01-01T00:00:00Z",
    "updated_at": "2025-01-01T01:00:00Z"
  }
}
```

---

## 📥 GET /api/metadata/files/{fileId}/download
업로드된 파일의 원본 내용을 다운로드합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/metadata/files/file-uuid/download \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -O  # 파일로 저장
```

### 응답 (성공 - 200)
```
Content-Type: application/jsonl
Content-Disposition: attachment; filename="session.jsonl"
Content-Length: 1024576

[파일 바이너리 내용]
```

---

## 🗑️ DELETE /api/metadata/files/{fileId}
업로드된 파일을 완전히 삭제합니다. (본인 파일만 삭제 가능)

### 요청
```bash
curl -X DELETE http://localhost:3001/api/metadata/files/file-uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "message": "File \"session.jsonl\" deleted successfully"
}
```

---

## 📊 GET /api/metadata/stats
팀의 파일 업로드 통계를 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/metadata/stats \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "total_files": 125,
    "total_size": 52428800,  // bytes
    "status_counts": {
      "uploaded": 100,
      "processing": 5,
      "processed": 18,
      "failed": 2
    },
    "tool_counts": {
      "claude-code": 80,
      "github-codex": 30,
      "gemini-cli": 15
    },
    "average_file_size": 419430  // bytes
  }
}
```

---

## 🚨 공통 에러 응답

### 파일 없음 (404)
```json
{
  "success": false,
  "error": "File not found"
}
```

### 권한 없음 (404)
```json
{
  "success": false,
  "error": "File not found or not authorized"
}
```

### 다운로드 실패 (500)
```json
{
  "success": false,
  "error": "Failed to download file"
}
```