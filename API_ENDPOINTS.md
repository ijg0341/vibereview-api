# 바이브리뷰 웹 API 엔드포인트 목록

> 현재 Supabase 직접 호출 방식에서 별도 API 서버로 마이그레이션하기 위한 필요 API 엔드포인트 목록

## 📋 개요
이 문서는 vibereview-web 프론트엔드에서 필요로 하는 모든 API 엔드포인트를 정의합니다. 
각 엔드포인트는 현재 Supabase 직접 호출을 REST API로 래핑하는 형태로 구현됩니다.


## ⚠️ 제외된 기능
- **리뷰 시스템**: 현재 구현하지 않음
- **팀 관리 기능**: 기본 팀만 존재, 관리 기능 없음
- **프로젝트 멤버십 관리**: 프로젝트는 개인 소유, 멤버 초대 기능 없음

---

## 🔐 인증 관련 API

### POST /auth/login
이메일/비밀번호로 로그인. JWT 토큰 반환해서 이후 API 호출에 사용

### POST /auth/signup  
신규 사용자 가입. 이메일 인증 후 계정 활성화

### POST /auth/logout
로그아웃 처리. 토큰 무효화

### GET /auth/session
현재 로그인한 사용자 정보 확인. 토큰 유효성 검증용

### POST /auth/callback
소셜 로그인(구글 등) OAuth 리다이렉트 처리

---

## 👤 사용자 관리 API

### GET /users/profile
내 프로필 조회 (이름, 이메일, 가입일 등)

### PUT /users/profile
프로필 수정 (닉네임, 프로필 이미지 등)

### GET /users/settings
사용자 설정 조회 (언어, 작업 디렉토리 경로 등)

### PUT /users/settings
사용자 설정 변경 (프로젝트 경로, 언어 설정 등)

---

## 📁 프로젝트 관리 API

### GET /projects
내가 참여한 프로젝트 목록. 메인 대시보드에서 프로젝트 카드들 표시

### POST /projects
새 프로젝트 생성. 프로젝트명, 설명, 폴더 경로 설정

### GET /projects/{id}
프로젝트 상세 페이지. 세션 목록, 통계, 멤버 정보 표시

### PUT /projects/{id}
프로젝트 이름, 설명 등 수정

### DELETE /projects/{id}
프로젝트 완전 삭제 (세션 데이터 포함)

### POST /projects/find-or-create
외부 도구에서 업로드 시 폴더명 기준으로 프로젝트 자동 생성/찾기

---


## 📝 세션 관리 API

### GET /projects/{projectId}/sessions
프로젝트의 Claude 세션 목록. 세션 이름, 업로드 날짜, 라인 수 표시

### POST /projects/{projectId}/sessions
수동으로 세션 생성 (웹에서 직접 입력)

### GET /sessions/{sessionId}
세션 메타데이터 조회 (이름, 생성일, 처리 상태 등)

### PUT /sessions/{sessionId}
세션 이름 변경 등

### DELETE /sessions/{sessionId}
세션 완전 삭제

### GET /sessions/{sessionId}/lines
세션의 대화 내용 조회. 프롬프트/응답 쌍들을 시간순으로 반환

### POST /sessions/{sessionId}/lines
세션에 새 대화 추가 (수동 입력용)

---

## 🏢 팀 관리 API

### GET /team/members
팀 멤버 목록 조회. 팀 페이지에서 모든 멤버 활동 현황 표시

### GET /team/members/{userId}/projects
특정 멤버가 작업한 프로젝트들. 멤버별 활동 분석용

### GET /team/members/{userId}/sessions
특정 멤버의 세션 목록. 개인별 작업 내역 확인

---

## 🤖 AI 요약 API

### POST /ai/generate-summary
세션 데이터를 분석해서 일별/주별 작업 요약 생성. OpenAI API 사용

### GET /ai/summaries
생성된 AI 요약들 조회. 대시보드에서 인사이트 표시용

---

## 🔑 API 키 관리 API

### GET /api-keys
내가 생성한 API 키 목록. 외부 도구 연동용 키들 관리

### POST /api-keys
새 API 키 생성. 외부 도구에서 업로드할 때 사용할 인증키

### PUT /api-keys/{id}
API 키 이름 변경, 활성화/비활성화

### DELETE /api-keys/{id}
API 키 완전 삭제

### POST /api-keys/verify
외부 도구에서 업로드 시 API 키 유효성 검사

---

## 📤 파일 업로드 API

### POST /upload
외부 도구에서 Claude 세션 파일(.jsonl) 업로드. 파일 파싱 후 DB 저장

---

## 📊 통계 및 대시보드 API

### GET /stats/dashboard
메인 대시보드 통계. 총 프로젝트 수, 세션 수, 최근 활동 등

### GET /stats/projects/{id}
프로젝트 통계. 세션 수, 라인 수, 활동 추이, 멤버별 기여도

### GET /stats/users/{id}
사용자 통계. 개인 활동량, 프로젝트 참여 현황, 작업 패턴

---

## 🔍 검색 및 필터링 API

### GET /search/projects
프로젝트 이름, 설명으로 검색. 검색창에서 자동완성 지원

### GET /search/sessions
세션 이름, 내용으로 검색. 특정 프롬프트/응답 찾기

### GET /search/users
팀 멤버 이름, 이메일로 검색. 멤버 초대할 때 사용

---

## 📝 구현 참고사항

### 인증 방식
- JWT 토큰 기반 인증
- Bearer Token 형태로 Authorization 헤더에 포함

### 응답 형식
모든 API는 다음 형태의 JSON 응답을 반환:
```json
{
  "success": boolean,
  "data": any,
  "error": string?,
  "message": string?
}
```

### 에러 처리
- 표준 HTTP 상태 코드 사용
- 4xx: 클라이언트 에러
- 5xx: 서버 에러
- 에러 상세 정보는 response body에 포함

### 페이지네이션
목록 조회 API는 다음 쿼리 파라미터를 지원:
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 항목 수 (기본값: 20)
- `sort`: 정렬 기준
- `order`: 정렬 순서 (asc/desc)

### 필터링
검색 API는 다음 쿼리 파라미터를 지원:
- `q`: 검색어
- `filter`: 추가 필터 조건
- `date_from`, `date_to`: 날짜 범위 필터

---


## 📅 업데이트 이력
- 2025-01-15: 초기 API 엔드포인트 목록 작성
- 2025-01-15: 리뷰 시스템 API 제거, 팀 관리를 조회 전용으로 변경
- 2025-01-15: 프로젝트 멤버십 관리 API 제거 (개인 프로젝트만 지원)
- 2025-01-15: CLI 관련 내용 제거, 마이그레이션 우선순위 제거
- 향후 API 서버 개발 과정에서 세부 사항 추가 예정