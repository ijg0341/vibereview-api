# 시스템 API 문서

## 📋 개요
서버 상태 확인 및 시스템 정보를 제공하는 API들입니다.

---

## ⚡ GET /health
API 서버의 상태와 버전 정보를 확인합니다. 인증이 필요하지 않습니다.

### 요청
```bash
curl -X GET http://localhost:3001/health
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "message": "VibeReview API is running",
  "timestamp": "2025-01-01T12:00:00.123Z",
  "version": "1.0.0"
}
```

### 사용 사례
- **서버 상태 모니터링**: 서버가 정상 작동하는지 확인
- **배포 검증**: 새 배포 후 서버 응답 확인
- **로드 밸런서**: Health check 엔드포인트로 사용
- **CI/CD 파이프라인**: 배포 후 자동 검증

---

## 🚨 서버 다운시 응답

### 서버 응답 없음
```
Connection refused 또는 Timeout
```

### 서버 시작 중
```json
{
  "success": false,
  "error": "Server is starting up"
}
```