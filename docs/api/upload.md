# 파일 업로드 API 문서

## 📋 개요
AI 도구 세션 파일을 업로드하고 처리 상태를 관리하는 API들입니다.

---

## 📤 POST /api/upload/file
단일 파일을 업로드합니다. 중복 파일은 메타데이터만 업데이트됩니다.

### 요청
```bash
curl -X POST http://localhost:3001/api/upload/file \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "file=@session.jsonl" \
  -F "tool_name=claude-code" \
  -F "session_date=2025-01-01" \
  -F 'metadata={"project":"my-project","version":"1.0"}'
```

### API 키로 업로드 (CLI용)
```bash
curl -X POST http://localhost:3001/api/upload/file \
  -H "Authorization: ApiKey vr_abcd1234efgh5678..." \
  -F "file=@session.jsonl" \
  -F "tool_name=claude-code"
```

### 요청 파라미터
- `file` (필수): 업로드할 세션 파일 (.json, .jsonl, .csv, .txt)
- `tool_name` (선택): AI 도구 이름 (자동 감지됨)
- `session_date` (선택): 세션 날짜 (YYYY-MM-DD)
- `metadata` (선택): 추가 메타데이터 (JSON 문자열)

### 응답 (성공 - 201)
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "data": {
    "file_id": "file-uuid",
    "filename": "session.jsonl",
    "size": 1024576,
    "storage_path": "team-uuid/user-uuid/hash.jsonl",
    "upload_status": "uploaded",
    "tool_name": "claude-code",
    "session_date": "2025-01-01",
    "is_duplicate": false
  }
}
```

### 응답 (중복 파일 - 200)
```json
{
  "success": true,
  "message": "File metadata updated successfully (duplicate file detected)",
  "data": {
    "file_id": "existing-file-uuid",
    "filename": "session.jsonl",
    "size": 1024576,
    "upload_status": "uploaded",
    "tool_name": "claude-code",
    "is_duplicate": true
  }
}
```

---

## 📊 GET /api/upload/status/{fileId}
파일 업로드 및 처리 상태를 확인합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/upload/status/file-uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "id": "file-uuid",
    "original_filename": "session.jsonl",
    "upload_status": "processed",  // uploaded, processing, processed, failed
    "processing_error": null,
    "created_at": "2025-01-01T00:00:00Z"
  }
}
```

---

## 📦 POST /api/upload/batch
여러 파일을 한 번에 업로드합니다. (현재 구현 중)

### 요청
```bash
curl -X POST http://localhost:3001/api/upload/batch \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -F "files=@session1.jsonl" \
  -F "files=@session2.jsonl"
```

### 응답 (구현 예정 - 501)
```json
{
  "success": false,
  "error": "Batch upload not implemented yet"
}
```

---

## 🚨 공통 에러 응답

### 파일 없음 (400)
```json
{
  "success": false,
  "error": "No file provided"
}
```

### 파일 크기 초과 (400)
```json
{
  "success": false,
  "error": "File size exceeds maximum limit (50MB)"
}
```

### 지원하지 않는 파일 형식 (400)
```json
{
  "success": false,
  "error": "Unsupported file type. Allowed: .json, .jsonl, .csv, .txt"
}
```

### 파일 없음 (404)
```json
{
  "success": false,
  "error": "File not found"
}
```

### 스토리지 에러 (500)
```json
{
  "success": false,
  "error": "Failed to upload file to storage"
}
```