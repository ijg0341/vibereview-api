/**
 * AI 요약 마크다운을 파싱하여 구조화된 데이터로 변환하는 유틸리티
 */

export interface ParsedTask {
  task: string;
  promptCount: number;
  category: string;
  estimatedTime: string;
  rawText: string; // 원본 텍스트 보관
}

export interface ProjectTasks {
  projectName: string;
  tasks: ParsedTask[];
}

export interface ParsedSummaryData {
  dailySummary: string;
  tasksByProject: ProjectTasks[];
  totalTasks: number;
  categoryCounts: Record<string, number>;
  parseSuccess: boolean;
  errors: string[];
}

/**
 * AI 생성 마크다운 요약을 파싱
 */
export function parseSummaryMarkdown(markdownText: string): ParsedSummaryData {
  const result: ParsedSummaryData = {
    dailySummary: '',
    tasksByProject: [],
    totalTasks: 0,
    categoryCounts: {},
    parseSuccess: false,
    errors: []
  };

  try {
    // 1. 일일 요약 추출 (500자 이내)
    result.dailySummary = extractDailySummary(markdownText);

    // 2. 프로젝트별 작업 목록 추출
    result.tasksByProject = extractProjectTasks(markdownText, result.errors);

    // 3. 통계 계산
    result.totalTasks = result.tasksByProject.reduce((sum, project) => sum + project.tasks.length, 0);
    result.categoryCounts = calculateCategoryCounts(result.tasksByProject);

    // 4. 파싱 성공 여부 판단
    result.parseSuccess = result.dailySummary.length > 0 || result.totalTasks > 0;

  } catch (error) {
    result.errors.push(`파싱 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * 일일 업무 요약 추출
 */
function extractDailySummary(markdownText: string): string {
  const summaryRegex = /## 📝 오늘의 업무 요약.*?\n([\s\S]*?)(?=\n## |$)/;
  const match = markdownText.match(summaryRegex);
  
  if (match && match[1]) {
    return match[1]
      .replace(/\[|\]/g, '') // 대괄호 제거
      .trim()
      .substring(0, 500); // 500자 제한
  }
  
  return '';
}

/**
 * 프로젝트별 작업 목록 추출
 */
function extractProjectTasks(markdownText: string, errors: string[]): ProjectTasks[] {
  const projects: ProjectTasks[] = [];
  
  // 프로젝트 섹션 추출 (### 프로젝트: 로 시작하는 부분)
  const projectRegex = /### 프로젝트: ([^\n]+)\n([\s\S]*?)(?=\n### 프로젝트:|$)/g;
  let projectMatch;

  while ((projectMatch = projectRegex.exec(markdownText)) !== null) {
    const projectName = projectMatch[1]?.trim() || 'Unknown';
    const projectContent = projectMatch[2] || '';

    try {
      const tasks = parseTasksFromContent(projectContent, errors);
      
      if (tasks.length > 0) {
        projects.push({
          projectName,
          tasks
        });
      }
    } catch (error) {
      errors.push(`프로젝트 "${projectName}" 파싱 오류: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return projects;
}

/**
 * 프로젝트 콘텐츠에서 개별 작업들 파싱
 */
function parseTasksFromContent(content: string, errors: string[]): ParsedTask[] {
  const tasks: ParsedTask[] = [];
  
  // 체크박스 항목 추출 (- [ ] 로 시작하는 라인들)
  const taskRegex = /- \[ \] (.+)/g;
  let taskMatch;

  while ((taskMatch = taskRegex.exec(content)) !== null) {
    const rawTaskText = taskMatch[1]?.trim() || '';
    
    if (rawTaskText) {
      try {
        const parsedTask = parseTaskMetadata(rawTaskText);
        if (parsedTask) {
          tasks.push(parsedTask);
        }
      } catch (error) {
        errors.push(`작업 파싱 오류: "${rawTaskText}" - ${error instanceof Error ? error.message : String(error)}`);
        
        // 파싱 실패해도 기본 정보로 보관
        tasks.push({
          task: rawTaskText,
          promptCount: 1,
          category: '기타',
          estimatedTime: '미정',
          rawText: rawTaskText
        });
      }
    }
  }

  return tasks;
}

/**
 * 작업 텍스트에서 메타데이터 파싱
 * 예: "사용자 인증 API 구현 (프롬프트 3회, 기능구현, 30분)"
 */
function parseTaskMetadata(taskText: string): ParsedTask | null {
  // 메타데이터 패턴: (프롬프트 N회, 카테고리, 시간)
  const metadataRegex = /^(.+?)\s*\(프롬프트\s+(\d+)회,\s*([^,]+),\s*([^)]+)\)$/;
  const match = taskText.match(metadataRegex);

  if (match) {
    const [, task, promptCount, category, estimatedTime] = match;
    
    return {
      task: task?.trim() || taskText,
      promptCount: parseInt(promptCount || '1', 10),
      category: category?.trim() || '기타',
      estimatedTime: estimatedTime?.trim() || '미정',
      rawText: taskText
    };
  }

  // 메타데이터가 없는 경우 기본값 설정
  return {
    task: taskText,
    promptCount: 1,
    category: '기타',
    estimatedTime: '미정',
    rawText: taskText
  };
}

/**
 * 카테고리별 작업 수 계산
 */
function calculateCategoryCounts(projects: ProjectTasks[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  projects.forEach(project => {
    project.tasks.forEach(task => {
      counts[task.category] = (counts[task.category] || 0) + 1;
    });
  });

  return counts;
}

/**
 * 파싱된 데이터를 JSON으로 직렬화 (DB 저장용)
 */
export function serializeParsedData(data: ParsedSummaryData): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return JSON.stringify({
      error: `직렬화 실패: ${error instanceof Error ? error.message : String(error)}`,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * 직렬화된 JSON을 파싱된 데이터로 역직렬화
 */
export function deserializeParsedData(jsonString: string): ParsedSummaryData | null {
  try {
    const parsed = JSON.parse(jsonString);
    
    // 기본 구조 검증
    if (typeof parsed === 'object' && parsed !== null) {
      return {
        dailySummary: parsed.dailySummary || '',
        tasksByProject: parsed.tasksByProject || [],
        totalTasks: parsed.totalTasks || 0,
        categoryCounts: parsed.categoryCounts || {},
        parseSuccess: parsed.parseSuccess || false,
        errors: parsed.errors || []
      };
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * 유효한 작업 카테고리 목록
 */
export const VALID_CATEGORIES = [
  '기능구현',
  '버그수정', 
  '리팩토링',
  'UI개선',
  '문서작업',
  '설정작업',
  '테스트',
  '기타'
] as const;

export type TaskCategory = typeof VALID_CATEGORIES[number];