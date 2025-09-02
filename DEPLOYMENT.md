# Railway 배포 가이드

## 🚂 Railway로 VibeReview API 배포하기

### 1️⃣ 사전 준비

#### ✅ 필요한 것들
- GitHub 계정 및 레포지토리
- Railway 계정 (GitHub으로 가입)
- Supabase 프로덕션 프로젝트
- 프론트엔드 배포 URL: `https://vibe-review.vercel.app`

---

## 🚀 배포 단계

### **1단계: GitHub 레포지토리 생성**

1. GitHub에서 새 레포지토리 생성
   - 레포명: `vibereview-api`
   - Public/Private 선택

2. 로컬 레포와 연결
```bash
git remote add origin https://github.com/YOUR_USERNAME/vibereview-api.git
git branch -M main
git push -u origin main
```

### **2단계: Railway 프로젝트 생성**

1. [Railway.app](https://railway.app) 접속
2. "Login with GitHub" 클릭
3. "New Project" → "Deploy from GitHub repo" 선택
4. `vibereview-api` 레포지토리 선택
5. 자동으로 배포 시작됨

### **3단계: 환경변수 설정**

Railway Dashboard > Variables에서 다음 환경변수 설정:

```bash
# Supabase (프로덕션)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci...
DATABASE_URL=postgresql://postgres.your-project:password@aws-region.pooler.supabase.com:5432/postgres

# 서버 설정
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# 업로드 설정
MAX_FILE_SIZE=52428800
ALLOWED_MIME_TYPES=application/json,application/jsonl,text/plain,text/csv,application/x-jsonlines

# 레이트 리미팅 (프로덕션용)
RATE_LIMIT_MAX=1000
RATE_LIMIT_WINDOW=900000
```

### **4단계: 도메인 확인**

- Railway가 자동으로 도메인 생성: `https://vibereview-api-production.railway.app`
- 또는 커스텀 도메인 설정 가능

---

## ✅ 배포 후 확인사항

### **API 서버 테스트**
```bash
# Health Check
curl https://your-app.railway.app/health

# Swagger UI 접속
https://your-app.railway.app/docs

# 테스트 페이지 접속  
https://your-app.railway.app/test/
```

### **프론트엔드 연동 확인**
- `https://vibe-review.vercel.app`에서 API 호출 테스트
- CORS 설정이 올바른지 확인

---

## 🔄 자동 배포

Railway는 **Git Push 기반 자동 배포**를 지원합니다:

```bash
# 코드 수정 후
git add .
git commit -m "Update API"
git push origin main

# → Railway가 자동으로 감지하고 재배포
```

---

## 🔧 Railway 설정 최적화

### **1. Build Command (자동 감지됨)**
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### **2. Health Check 설정**
Railway > Settings > Health Check:
- **Path**: `/health`
- **Expected Status**: `200`

### **3. 리소스 모니터링**
- Railway Dashboard에서 CPU/메모리 사용량 모니터링
- 로그 실시간 확인 가능

---

## 🚨 주의사항

1. **Supabase 프로덕션 설정**
   - Database 비밀번호에 특수문자 피하기
   - Connection pooling URL 사용

2. **환경변수 보안**
   - SERVICE_KEY는 절대 노출 금지
   - Railway Variables는 암호화됨

3. **도메인 CORS**
   - 프론트엔드 도메인 정확히 설정
   - 와일드카드 피하기

---

## 💡 배포 완료 후 할 일

1. **API URL 프론트엔드에 설정**
2. **Supabase RLS 정책 재확인** 
3. **실제 파일 업로드 테스트**
4. **성능 모니터링 시작**

**Railway는 무료 플랜으로도 충분히 테스트 가능하고, 사용량에 따라 자동 스케일링됩니다!** 🎯