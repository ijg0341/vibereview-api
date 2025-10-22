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
당신은 개발자의 AI 코딩 세션을 분석하는 전문가입니다.
아래 세션 데이터를 분석하여 **JSON 형식으로만** 응답해주세요.

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

# 응답 형식 (JSON만 출력, 설명 금지)

{
  "summary": {
    "프로젝트-슬러그": "해당 프로젝트의 전체적인 작업 총평 (100-150자)"
  },
  "work_categories": {
    "planning": { "minutes": 0, "percentage": 0, "description": "작업 내용 또는 null" },
    "frontend": { "minutes": 0, "percentage": 0, "description": "작업 내용 또는 null" },
    "backend": { "minutes": 0, "percentage": 0, "description": "작업 내용 또는 null" },
    "qa": { "minutes": 0, "percentage": 0, "description": "작업 내용 또는 null" },
    "devops": { "minutes": 0, "percentage": 0, "description": "작업 내용 또는 null" },
    "research": { "minutes": 0, "percentage": 0, "description": "작업 내용 또는 null" },
    "other": { "minutes": 0, "percentage": 0, "description": "작업 내용 또는 null" }
  },
  "project_todos": {
    "프로젝트-슬러그": {
      "project_id": "추정 불가시 null",
      "project_name": "프로젝트명",
      "todos": [
        {
          "text": "구체적인 작업 내용",
          "category": "frontend"
        }
      ]
    }
  },
  "quality_score": 0.85,
  "quality_score_explanation": "점수에 대한 근거 설명 (200자 이내)"
}
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
