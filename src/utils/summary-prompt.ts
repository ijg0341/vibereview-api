/**
 * AI 요약 생성을 위한 프롬프트 생성 및 데이터 정제 유틸리티
 */

export interface ProjectText {
  projectName: string;
  userText: string;
}

export interface SessionData {
  id: string;
  session_id: string;
  project_name: string;
}

export interface SessionContent {
  session_id: string;
  messages: {
    messages: Array<{
      type: string;
      content: any;
    }>;
  };
}

/**
 * session_content에서 사용자 메시지만 추출하여 프로젝트별로 그룹화
 */
export function extractProjectTexts(
  sessions: SessionData[],
  contents: SessionContent[]
): ProjectText[] {
  const projectGroups: Record<string, string[]> = {};

  contents?.forEach((content: SessionContent) => {
    const session = sessions.find((s) => s.id === content.session_id);
    const projectName = session?.project_name || "unknown";

    if (!projectGroups[projectName]) {
      projectGroups[projectName] = [];
    }

    // messages.messages 배열에서 user type 메시지만 추출
    const userMessages =
      content.messages?.messages
        ?.filter((msg) => msg.type === "user")
        ?.map((msg) => msg.content)
        ?.filter((content) => typeof content === "string") || [];

    projectGroups[projectName].push(...userMessages);
  });

  // projectTexts 형태로 변환
  return Object.entries(projectGroups).map(([projectName, texts]) => ({
    projectName,
    userText: texts.join("\n\n"),
  }));
}

/**
 * AI 요약 생성을 위한 프롬프트 생성
 */
export function generateSummaryPrompt(
  date: string,
  projectData: ProjectText[]
): string {
  let analysisPrompt = `
🚨 응답 형식: 반드시 아래 JSON 구조만 사용하세요. 다른 필드 추가 금지.

필수 필드 (오직 이 5개만):
- summary (객체, 문자열 아님!)
- work_categories (7개 카테고리를 가진 객체)
- project_todos (객체)
- quality_score (숫자)
- quality_score_explanation (문자열)

❌ 금지: "date", "projects", "dbChecks", "apis", "features", "actionsTaken", "overview", "done", "notes" 등의 필드 추가 금지
❌ 금지: summary를 문자열로 만들지 마세요 - 반드시 객체여야 합니다
❌ 금지: work_categories를 배열로 만들지 마세요 - 반드시 객체여야 합니다
❌ 금지: 모든 응답은 한글로 작성해야 합니다

# 세션 데이터
날짜: ${date}
총 프로젝트 수: ${projectData.length}

## 프로젝트별 세션 내역
${projectData
  .map((project) => {
    const messages = project.userText
      .split("\n\n")
      .filter((text: string) => text.trim().length > 0);
    const totalLength = project.userText.length;
    const messageCount = messages.length;

    return `
### 프로젝트: ${project.projectName}
총 ${messageCount}개 프롬프트, 총 ${totalLength}자

${project.userText}
`;
  })
  .join("\n")}

---

# 분석 요청

## 1. 업무 카테고리 분류
각 카테고리별로 업무를 추정하고, 구체적인 작업 내용을 설명해주세요.

**카테고리 정의:**
- **planning**: 요구사항 분석, 설계, 아키텍처 논의
- **frontend**: UI/UX 개발, 컴포넌트 작성, 스타일링
- **backend**: API 개발, 서버 로직, 데이터베이스 작업
- **qa**: 테스트 작성, 버그 수정, 코드 리뷰, 리팩토링
- **devops**: 배포, 인프라 설정, CI/CD
- **research**: 문서 조사, 학습, 새로운 기술 탐색
- **other**: 기타 (구체적으로 명시)

각 카테고리별 예상 작업 시간(분)과 비율(%)을 계산하고, 수행한 작업을 간략히 설명하세요.
작업하지 않은 카테고리는 minutes: 0, percentage: 0, description: null로 설정하세요.

## 2. 프로젝트별 Todo 리스트
각 프로젝트에서 수행한 작업을 구체적으로 나열해주세요.
- text: 구체적인 작업 내용
- category: 해당 작업의 카테고리 (planning/frontend/backend/qa/devops/research/other)

## 3. 업무 요약 (프로젝트별 총평)
각 프로젝트에서 수행한 작업들의 전체적인 흐름과 목적을 총평하세요.
개별 작업 나열보다는 "무엇을 위해 어떤 작업들을 했는지" 관점에서 서술하세요.

**작성 예시:**
"프로젝트A: 사용자 인증 기능을 구현하기 위해 백엔드 API와 프론트엔드 UI 작업을 진행했습니다. JWT 토큰 기반 로그인/로그아웃 플로우를 완성하고, 에러 처리와 테스트까지 마쳤습니다."

각 프로젝트당 100-150자 내외로 작성하세요.

## 4. 품질 점수 및 근거
**Claude 베스트 프랙티스 기반 평가 기준**에 따라 0.00 ~ 1.00 사이의 점수를 엄격하게 부여하세요:

**평가 기준 (각 항목당 20점 만점):**
1. **명확한 지시사항**: 요청이 구체적이고 모호하지 않은가?
2. **충분한 컨텍스트**: 배경 정보, 제약사항, 목적이 명확한가?
3. **구체적인 예시**: 입력/출력 예시나 구체적인 사례를 제공했는가?
4. **명확한 출력 형식**: 원하는 응답 형식을 명시했는가?
5. **단계적 사고 유도**: 복잡한 문제를 단계별로 나누어 요청했는가?

**점수 부여 원칙:**
- 0.9-1.0: 5가지 기준을 모두 충족, 모범적인 프롬프트
- 0.8-0.89: 4가지 기준 충족, 일부 개선 여지
- 0.7-0.79: 3가지 기준 충족, 여러 개선점 필요
- 0.6-0.69: 2가지 기준 충족, 상당한 개선 필요
- 0.0-0.59: 기준 미달, 대부분 모호하거나 불충분한 프롬프트

quality_score_explanation에는 어떤 기준을 충족/미충족했는지 구체적으로 설명하세요 (200자 이내).

**예시:**
"명확한 지시와 충분한 컨텍스트 제공(+40). 하지만 구체적인 예시 없음(-20), 출력 형식 불명확(-20). 단계적 접근 부재(-20). 총 40점으로 0.4점 부여."

---

# 🚨 정확한 응답 형식 (위반 시 거부됨)

반드시 이 구조만 사용하세요.

## ❌ 잘못된 예시 (절대 이렇게 하지 마세요):

\`\`\`json
// 🚫 이런 식으로 응답하면 안 됩니다!
{
  "summary": {
    "newways-staging": {
      "overview": "...",  // ❌ 객체로 만들면 안 됨! 문자열이어야 함!
      "done": [...],      // ❌ 배열 추가하면 안 됨!
      "notes": [...]      // ❌ 추가 필드 금지!
    }
  },
  "work_categories": {
    "planning": ["작업1", "작업2"],  // ❌ 배열로 만들면 안 됨!
    "frontend": ["작업3"]            // ❌ 객체여야 합니다!
  },
  "project_todos": {
    "프로젝트-1": [                 // ❌ 배열로 만들면 안 됨!
      "할일 1",                       // ❌ 객체여야 합니다!
      "할일 2"
    ]
  }
}
\`\`\`

🚫 **특히 주의: project_todos**
- project_todos의 각 프로젝트는 **반드시 객체**여야 합니다
- 배열이 아닙니다!
- 객체 안에 project_id, project_name, todos(배열) 필드가 있어야 합니다
\`\`\`json
// ❌ 잘못된 형태
"project_todos": {
  "프로젝트-1": ["할일1", "할일2"]  // 이렇게 배열로 하면 안 됨!
}

// ✅ 올바른 형태
"project_todos": {
  "프로젝트-1": {
    "project_id": null,
    "project_name": "프로젝트명",
    "todos": [
      { "text": "할일1", "category": "backend" },
      { "text": "할일2", "category": "frontend" }
    ]
  }
}
\`\`\`

## ✅ 올바른 예시 (반드시 이렇게 응답하세요):

\`\`\`json
{
  "summary": {
    "프로젝트-1": "관리자 사용자 관리 기능 개발. DB 확인 후 백엔드 API(통계/리스트/상세/수정) 구현하고 프론트엔드 UI(필터/테이블/상세페이지) 완성. CSV 다운로드 추가.",
    "프로젝트-2": "정책 요청 기능 문서화 및 백엔드 API 구현. 프론트엔드 탭 UI 추가하고 테스트 데이터 삽입하여 검증 완료."
  },
  "work_categories": {
    "planning": { "minutes": 45, "percentage": 15, "description": "US-1~5 요구사항 문서 작성 및 개발 플로우 정의" },
    "frontend": { "minutes": 90, "percentage": 30, "description": "관리자 페이지 UI 구현(통계 카드, 필터, 테이블, 상세페이지, CSV 다운로드 버튼)" },
    "backend": { "minutes": 120, "percentage": 40, "description": "사용자 통계/리스트/상세 조회 및 수정 API 구현, CSV export 엔드포인트 추가" },
    "qa": { "minutes": 30, "percentage": 10, "description": "테스트 데이터 삽입 및 주요 API 수동 검증" },
    "devops": { "minutes": 15, "percentage": 5, "description": "개발 서버 재시작 및 환경 설정" },
    "research": { "minutes": 0, "percentage": 0, "description": null },
    "other": { "minutes": 0, "percentage": 0, "description": null }
  },
  "project_todos": {
    "프로젝트-1": {                    // ← 주의: 프로젝트명이 key입니다
      "project_id": null,              // ← 반드시 포함 (추정 불가시 null)
      "project_name": "뉴웨이즈 관리자",  // ← 반드시 포함 (프로젝트 이름)
      "todos": [                        // ← 반드시 포함 (배열)
        { "text": "구독 관리 API 구현 및 성능 최적화", "category": "backend" },
        { "text": "구독 탭 UI 연결 및 테스트", "category": "frontend" },
        { "text": "대용량 CSV 스트리밍 처리 구현", "category": "backend" }
      ]
    },
    "프로젝트-2": {                    // ← 프로젝트가 여러 개면 각각 객체로 추가
      "project_id": null,
      "project_name": "다른 프로젝트",
      "todos": [
        { "text": "테스트 작성", "category": "qa" }
      ]
    }
  },
  "quality_score": 0.75,
  "quality_score_explanation": "명확한 지시사항과 컨텍스트 제공(+40점). 구체적인 예시는 부족(-20점). 출력 형식 명시(+20점). 단계적 접근 부재(-20점). 총 60점으로 0.6점."
}
\`\`\`

🔒 엄격한 규칙:
1. ✅ 오직 5개 필드만: summary, work_categories, project_todos, quality_score, quality_score_explanation
2. ✅ summary = 객체 (key: 프로젝트명, value: 총평 문자열 - 100~150자)
3. ✅ work_categories = 정확히 7개 카테고리 (planning/frontend/backend/qa/devops/research/other)
4. ✅ 각 카테고리는 minutes(숫자), percentage(숫자), description(문자열 또는 null) 포함
5. ✅ **[중요]** project_todos는 **객체**입니다 (배열 아님!)
   - 각 프로젝트는 반드시 { project_id, project_name, todos } 형태의 **객체**
   - todos는 { text, category } 객체들의 **배열**
   - 잘못된 예: "project_todos": { "프로젝트": ["할일1", "할일2"] } ❌
   - 올바른 예: "project_todos": { "프로젝트": { "project_id": null, "project_name": "...", "todos": [{...}] } } ✅
6. ✅ 모든 필드 필수 (생략 불가)
7. ✅ 모든 텍스트는 한글로 작성
8. ✅ quality_score는 0.0 ~ 1.0 사이의 소수점 숫자 (88 같은 정수 아님!)
9. ❌ 추가 필드 절대 금지 (date, projects, overview, done, notes 등)
10. ❌ 마크다운 형식 금지, JSON만 출력

위 세션 데이터를 분석하여 오직 JSON만 출력하세요:
`;

  // 프롬프트 길이 제한 (150k 문자)
  const MAX_CHARS = 150000;
  if (analysisPrompt.length > MAX_CHARS) {
    analysisPrompt =
      analysisPrompt.substring(0, MAX_CHARS) +
      "\n\n... (텍스트가 잘렸습니다)";
  }

  return analysisPrompt;
}

/**
 * 프롬프트 데이터 통계 정보
 */
export interface PromptStats {
  promptLength: number;
  projectCount: number;
  totalMessages: number;
  totalCharacters: number;
}

/**
 * 생성된 프롬프트의 통계 정보 계산
 */
export function getPromptStats(
  prompt: string,
  projectData: ProjectText[]
): PromptStats {
  const totalMessages = projectData.reduce((sum, project) => {
    return (
      sum + project.userText.split("\n\n").filter((t) => t.trim().length > 0).length
    );
  }, 0);

  const totalCharacters = projectData.reduce(
    (sum, project) => sum + project.userText.length,
    0
  );

  return {
    promptLength: prompt.length,
    projectCount: projectData.length,
    totalMessages,
    totalCharacters,
  };
}
