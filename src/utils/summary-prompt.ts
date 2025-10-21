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
다음은 한 사용자가 ${date} 날짜에 프로젝트별로 작성한 모든 사용자 메시지들입니다:

${projectData
  .map((project) => {
    const messages = project.userText
      .split("\n\n")
      .filter((text: string) => text.trim().length > 0);
    const totalLength = project.userText.length;
    const messageCount = messages.length;

    return `
## 프로젝트: ${project.projectName}
총 ${messageCount}개 프롬프트, 총 ${totalLength}자

${project.userText}
`;
  })
  .join("\n")}

위 메시지들을 분석해서 다음 형태로 응답해주세요:

## 📝 오늘의 업무 요약
[사용자가 오늘 진행한 핵심 업무들을 500자 이내로 간결하게 요약해주세요. 주요 성과와 작업한 프로젝트들, 해결한 문제들을 중심으로 서술]

## ✅ 완료한 작업 목록

${projectData
  .map(
    (project) => `### 프로젝트: ${project.projectName}
- [ ] [해당 프로젝트에서 완료한 구체적인 작업 항목들]`
  )
  .join("\n\n")}

**작업 분석 지침:**
1. 각 프롬프트에서 실제로 요청하거나 작업한 구체적인 내용을 추출
2. "API 엔드포인트 구현", "버그 수정", "UI 컴포넌트 개발" 등 명확한 작업 단위로 표현
3. 체크박스(- [ ]) 형태로 TODO 리스트 작성
4. 한국어로 작성하되, 기술 용어는 그대로 유지

**작업 카테고리:**
- 기능구현: 새로운 기능이나 API 개발
- 버그수정: 오류나 문제점 해결
- 리팩토링: 코드 구조나 성능 개선
- UI개선: 사용자 인터페이스 수정
- 문서작업: 문서화나 주석 작성
- 설정작업: 환경설정이나 도구 설정
- 테스트: 테스트 코드 작성이나 검증

**응답 예시:**
- [ ] 사용자 인증 API 엔드포인트 구현
- [ ] 데이터베이스 연결 오류 수정
- [ ] 대시보드 레이아웃 개선
- [ ] API 문서 업데이트
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
