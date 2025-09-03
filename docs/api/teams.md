# 팀 관리 API 문서

## 📋 개요
팀 멤버 관리 및 상세 분석을 위한 API들입니다. 팀별 활동 현황과 개인별 인사이트를 제공합니다.

---

## 👥 GET /api/teams/current/members
현재 팀에 속한 모든 멤버들과 활동 요약을 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/teams/current/members \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "team": {
      "id": "team-uuid",
      "name": "Default Team",
      "description": "Auto-generated default team",
      "member_count": 3
    },
    "members": [
      {
        "id": "member1-uuid",
        "full_name": "김개발자",
        "username": "dev_kim",
        "avatar_url": "https://example.com/avatar1.jpg",
        "role": "admin",
        "created_at": "2025-01-01T00:00:00Z",
        "activity_summary": {
          "total_files": 45,
          "total_size": 47185920,  // bytes
          "last_upload": "2025-01-01T15:30:00Z",
          "favorite_tool": "claude-code",
          "projects_count": 7,
          "average_file_size": 1048576
        }
      },
      {
        "id": "member2-uuid", 
        "full_name": "박분석가",
        "username": "analyst_park",
        "avatar_url": null,
        "role": "member",
        "created_at": "2024-12-15T00:00:00Z",
        "activity_summary": {
          "total_files": 23,
          "total_size": 24117248,
          "last_upload": "2025-01-01T09:15:00Z",
          "favorite_tool": "github-codex",
          "projects_count": 3,
          "average_file_size": 1048576
        }
      }
    ]
  }
}
```

---

## 🔍 GET /api/teams/current/members/{userId}
특정 팀 멤버의 상세 통계와 일별 세션 카드를 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/teams/current/members/member1-uuid \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "member": {
      "id": "member1-uuid",
      "full_name": "김개발자",
      "username": "dev_kim", 
      "role": "admin",
      "joined_at": "2025-01-01T00:00:00Z"
    },
    "insights": {
      "overview": {
        "total_files": 45,
        "total_size": 47185920,
        "average_file_size": 1048576,
        "recent_activity": 12,  // 최근 30일
        "activity_percentage": 27  // 전체 대비 최근 활동 비율
      },
      "patterns": {
        "favorite_tools": [
          { "tool": "claude-code", "count": 25 },
          { "tool": "github-codex", "count": 15 },
          { "tool": "cursor", "count": 5 }
        ],
        "peak_hours": ["10시", "14시", "16시"],
        "most_active_weekday": "화요일",
        "current_streak": 5  // 연속 활동 일수
      },
      "productivity": {
        "daily_average": 1.8,  // 일평균 업로드 수
        "size_efficiency": 1048576,  // 업로드당 평균 크기
        "consistency_score": 85,  // 일관성 점수 (0-100)
        "recent_trend": "increasing"  // increasing, decreasing, stable
      },
      "milestones": {
        "first_upload": "2024-11-15T09:00:00Z",
        "largest_session": {
          "id": "session-uuid",
          "filename": "large-session.jsonl",
          "file_size": 5242880,
          "created_at": "2024-12-20T14:30:00Z"
        },
        "most_productive_day": {
          "date": "2024-12-18",
          "sessions": 8,
          "size": 8388608
        },
        "total_projects": 7
      }
    },
    "daily_cards": [
      {
        "date": "2025-01-01",
        "session_count": 5,
        "total_size": 5242880,
        "tools_used": ["claude-code", "cursor"],
        "active_hours": ["9시", "14시", "16시"],
        "projects": ["project-a", "project-b"]
      },
      {
        "date": "2024-12-31",
        "session_count": 3,
        "total_size": 3145728,
        "tools_used": ["claude-code"],
        "active_hours": ["10시", "15시"],
        "projects": ["project-a"]
      }
    ]
  }
}
```

---

## 📅 GET /api/teams/current/members/{userId}/daily/{date}
특정 날짜의 모든 세션 상세 내용과 통계를 조회합니다.

### 요청
```bash
curl -X GET http://localhost:3001/api/teams/current/members/member1-uuid/daily/2025-01-01 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### URL 파라미터
- `userId`: 멤버 사용자 ID
- `date`: 조회할 날짜 (YYYY-MM-DD 형식)

### 응답 (성공 - 200)
```json
{
  "success": true,
  "data": {
    "date": "2025-01-01",
    "member": {
      "id": "member1-uuid",
      "full_name": "김개발자",
      "username": "dev_kim",
      "role": "admin"
    },
    "daily_stats": {
      "overview": {
        "total_sessions": 5,
        "total_size": 5242880,
        "average_size": 1048576,
        "unique_projects": 2
      },
      "tools": {
        "claude-code": 3,
        "cursor": 2
      },
      "hourly_distribution": {
        "9": 1,
        "14": 2,
        "16": 2
      },
      "projects": ["project-a", "project-b"],
      "time_span": {
        "first_session": "2025-01-01T09:15:00Z",
        "last_session": "2025-01-01T16:45:00Z"
      }
    },
    "sessions": [
      {
        "id": "session1-uuid",
        "filename": "morning-session.jsonl",
        "upload_time": "09:15:30",
        "file_size": 1048576,
        "tool_name": "claude-code",
        "project": "project-a",
        "upload_status": "processed",
        "metadata": {
          "project": "project-a",
          "feature": "authentication"
        },
        "session_data": {
          "mime_type": "application/octet-stream",
          "file_hash": "sha256-hash-here",
          "storage_path": "team-uuid/user-uuid/hash.jsonl"
        }
      },
      {
        "id": "session2-uuid",
        "filename": "afternoon-work.jsonl", 
        "upload_time": "14:22:10",
        "file_size": 2097152,
        "tool_name": "cursor",
        "project": "project-b",
        "upload_status": "processed",
        "metadata": {
          "project": "project-b",
          "component": "dashboard"
        },
        "session_data": {
          "mime_type": "application/octet-stream",
          "file_hash": "sha256-another-hash",
          "storage_path": "team-uuid/user-uuid/another-hash.jsonl"
        }
      }
    ]
  }
}
```

---

## 🚨 공통 에러 응답

### 멤버 없음 (404)
```json
{
  "success": false,
  "error": "Team member not found"
}
```

### 권한 없음 (403)
```json
{
  "success": false,
  "error": "User must be part of a team"
}
```

### 잘못된 날짜 형식 (400)
```json
{
  "success": false,
  "error": "Invalid date format. Use YYYY-MM-DD"
}
```

### 서버 에러 (500)
```json
{
  "success": false,
  "error": "Failed to fetch team information"
}
```

---

## 📊 인사이트 분석 항목

### **🎯 Overview (전체 요약)**
- 총 파일 수, 크기, 평균 크기
- 최근 30일 활동량 및 비율

### **🕐 Patterns (활동 패턴)**  
- 선호 도구 순위 (상위 5개)
- 활발한 시간대 (상위 3개)
- 가장 활동적인 요일
- 현재 연속 활동 일수

### **📈 Productivity (생산성 지표)**
- 일평균 업로드 수 
- 업로드당 평균 크기
- 일관성 점수 (0-100)
- 최근 트렌드 (증가/감소/안정)

### **🏆 Milestones (주요 마일스톤)**
- 첫 업로드 일시
- 가장 큰 세션 정보
- 가장 생산적이었던 날
- 총 참여 프로젝트 수

---

## 📝 사용 사례

### **팀 리더 대시보드**
- 팀 전체 멤버 활동 현황 파악
- 개별 멤버의 기여도 분석

### **개인 활동 분석**
- 자신의 작업 패턴 이해
- 생산성 개선 포인트 발견

### **프로젝트 관리**
- 일별 작업 내용 추적
- 특정 기간 활동 분석