/**
 * AI 요약 JSON을 파싱하여 구조화된 데이터로 변환하는 유틸리티
 */

export interface WorkCategoryData {
  minutes: number;
  percentage: number;
  description: string | null;
}

export interface WorkCategories {
  planning: WorkCategoryData;
  frontend: WorkCategoryData;
  backend: WorkCategoryData;
  qa: WorkCategoryData;
  devops: WorkCategoryData;
  research: WorkCategoryData;
  other: WorkCategoryData;
}

export interface TodoItem {
  text: string;
  category: 'planning' | 'frontend' | 'backend' | 'qa' | 'devops' | 'research' | 'other';
}

export interface ProjectTodo {
  project_id: string | null;
  project_name: string;
  todos: TodoItem[];
}

export interface ProjectTodos {
  [projectSlug: string]: ProjectTodo;
}

export interface ProjectSummary {
  [projectSlug: string]: string;
}

export interface ParsedSummaryData {
  summary: ProjectSummary;
  work_categories: WorkCategories;
  project_todos: ProjectTodos;
  quality_score: number;
  quality_score_explanation: string;
  parseSuccess: boolean;
  errors: string[];
}

/**
 * AI 생성 JSON 응답을 파싱
 */
export function parseSummaryJson(jsonText: string): ParsedSummaryData {
  const result: ParsedSummaryData = {
    summary: {},
    work_categories: getEmptyWorkCategories(),
    project_todos: {},
    quality_score: 0,
    quality_score_explanation: '',
    parseSuccess: false,
    errors: []
  };

  try {
    // JSON 추출 (```json ``` 블록 제거)
    const cleanedJson = extractJsonFromResponse(jsonText);

    // JSON 파싱
    const parsed = JSON.parse(cleanedJson);

    // 1. 요약 추출 (프로젝트별 객체)
    if (parsed.summary && typeof parsed.summary === 'object' && !Array.isArray(parsed.summary)) {
      result.summary = parsed.summary;
    } else {
      result.errors.push('summary 필드가 없거나 객체가 아닙니다.');
    }

    // 2. 업무 카테고리 추출 및 검증
    if (parsed.work_categories && typeof parsed.work_categories === 'object') {
      result.work_categories = validateWorkCategories(parsed.work_categories, result.errors);
    } else {
      result.errors.push('work_categories 필드가 없거나 객체가 아닙니다.');
    }

    // 3. 프로젝트별 TODO 추출 및 검증
    if (parsed.project_todos && typeof parsed.project_todos === 'object') {
      result.project_todos = validateProjectTodos(parsed.project_todos, result.errors);
    } else {
      result.errors.push('project_todos 필드가 없거나 객체가 아닙니다.');
    }

    // 4. 품질 점수 추출 및 검증
    if (typeof parsed.quality_score === 'number') {
      result.quality_score = Math.max(0, Math.min(1, parsed.quality_score)); // 0~1 범위 보정
    } else {
      result.errors.push('quality_score 필드가 없거나 숫자가 아닙니다.');
    }

    // 5. 품질 점수 설명 추출
    if (parsed.quality_score_explanation && typeof parsed.quality_score_explanation === 'string') {
      result.quality_score_explanation = parsed.quality_score_explanation.substring(0, 300); // 300자 제한
    } else {
      result.errors.push('quality_score_explanation 필드가 없거나 문자열이 아닙니다.');
    }

    // 6. 파싱 성공 여부 판단
    result.parseSuccess = Object.keys(result.summary).length > 0 && result.errors.length === 0;

  } catch (error) {
    result.errors.push(`JSON 파싱 중 오류 발생: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

/**
 * 응답에서 JSON 블록 추출 (코드 블록 제거)
 */
function extractJsonFromResponse(text: string): string {
  // ```json ... ``` 형태의 코드 블록 제거
  const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/;
  const match = text.match(jsonBlockRegex);

  if (match && match[1]) {
    return match[1].trim();
  }

  // 코드 블록이 없으면 전체 텍스트를 JSON으로 시도
  return text.trim();
}

/**
 * 업무 카테고리 검증 및 정규화
 */
function validateWorkCategories(categories: any, errors: string[]): WorkCategories {
  const result: WorkCategories = getEmptyWorkCategories();

  const validCategories: (keyof WorkCategories)[] = [
    'planning', 'frontend', 'backend', 'qa', 'devops', 'research', 'other'
  ];

  let totalPercentage = 0;

  validCategories.forEach(category => {
    if (categories[category] && typeof categories[category] === 'object') {
      const cat = categories[category];

      result[category] = {
        minutes: typeof cat.minutes === 'number' ? Math.max(0, cat.minutes) : 0,
        percentage: typeof cat.percentage === 'number' ? Math.max(0, Math.min(100, cat.percentage)) : 0,
        description: cat.description || null
      };

      totalPercentage += result[category].percentage;
    }
  });

  // 비율 합계 검증 (허용 오차 ±1%)
  if (totalPercentage > 0 && Math.abs(totalPercentage - 100) > 1) {
    errors.push(`work_categories의 percentage 합계가 100%가 아닙니다 (현재: ${totalPercentage}%)`);
  }

  return result;
}

/**
 * 프로젝트별 TODO 검증 및 정규화
 */
function validateProjectTodos(todos: any, errors: string[]): ProjectTodos {
  const result: ProjectTodos = {};

  Object.keys(todos).forEach(slug => {
    const project = todos[slug];

    if (project && typeof project === 'object') {
      result[slug] = {
        project_id: project.project_id || null,
        project_name: project.project_name || slug,
        todos: []
      };

      if (Array.isArray(project.todos)) {
        project.todos.forEach((todo: any, index: number) => {
          if (todo && typeof todo === 'object' && todo.text) {
            const validCategories = ['planning', 'frontend', 'backend', 'qa', 'devops', 'research', 'other'];
            const category = validCategories.includes(todo.category) ? todo.category : 'other';

            result[slug]!.todos.push({
              text: String(todo.text),
              category: category as TodoItem['category']
            });
          } else {
            errors.push(`프로젝트 "${slug}"의 ${index + 1}번째 todo 항목이 유효하지 않습니다.`);
          }
        });
      } else {
        errors.push(`프로젝트 "${slug}"의 todos가 배열이 아닙니다.`);
      }
    }
  });

  return result;
}

/**
 * 빈 업무 카테고리 구조 반환
 */
function getEmptyWorkCategories(): WorkCategories {
  return {
    planning: { minutes: 0, percentage: 0, description: null },
    frontend: { minutes: 0, percentage: 0, description: null },
    backend: { minutes: 0, percentage: 0, description: null },
    qa: { minutes: 0, percentage: 0, description: null },
    devops: { minutes: 0, percentage: 0, description: null },
    research: { minutes: 0, percentage: 0, description: null },
    other: { minutes: 0, percentage: 0, description: null }
  };
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
        summary: parsed.summary || {},
        work_categories: parsed.work_categories || getEmptyWorkCategories(),
        project_todos: parsed.project_todos || {},
        quality_score: parsed.quality_score || 0,
        quality_score_explanation: parsed.quality_score_explanation || '',
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
  'planning',
  'frontend',
  'backend',
  'qa',
  'devops',
  'research',
  'other'
] as const;

export type TaskCategory = typeof VALID_CATEGORIES[number];
