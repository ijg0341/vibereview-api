import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// System message - 스키마 강제
const SYSTEM_MESSAGE = `당신은 개발자 작업 세션을 분석하는 엄격한 JSON API입니다.

핵심 규칙:
1. 반드시 이 5개 필드만 응답: summary, work_categories, project_todos, quality_score, quality_score_explanation
2. 다른 필드 절대 추가 금지 (date, projects, dbChecks, apis, features 등)
3. summary는 프로젝트명이 key이고 총평 문자열이 value인 객체
4. work_categories는 planning/frontend/backend/qa/devops/research/other 7개 카테고리 (각각 minutes/percentage/description 포함)
5. project_todos는 배열이 아닌 객체! 각 프로젝트는 { project_id, project_name, todos: [{text, category}] } 형태
6. quality_score는 0.0~1.0 사이의 소수점 숫자 (88 같은 정수 아님)
7. 모든 응답은 반드시 한글로 작성
8. 사용자 메시지의 정확한 스키마를 따라야 함

추가 필드를 포함하거나 형식을 어기면 응답이 거부됩니다.`

// 기존 비스트리밍 방식 (하위 호환)
export async function generateWithClaude(prompt: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "system",
        content: SYSTEM_MESSAGE
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 10000,
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('No content in OpenAI response')
  }

  return content
}

// 스트리밍 방식 (OpenAI SDK 사용)
export async function generateWithClaudeStream(
  prompt: string,
  onChunk: (text: string) => void
): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  console.log('[Stream] Starting OpenAI streaming...')
  const startTime = Date.now()

  const stream = await openai.chat.completions.create({
    model: "gpt-5-mini",
    stream: true,
    messages: [
      {
        role: "system",
        content: SYSTEM_MESSAGE
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 10000,
  })

  let fullContent = ''
  let chunkCount = 0

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta) {
      fullContent += delta
      chunkCount++

      // 실시간으로 청크 전달
      onChunk(delta)

      if (chunkCount % 10 === 0) {
        const elapsed = Date.now() - startTime
        console.log(`[Stream] Chunk ${chunkCount} at ${elapsed}ms, length: ${fullContent.length}`)
      }
    }
  }

  const totalTime = Date.now() - startTime
  console.log(`[Stream] Completed in ${totalTime}ms. Total chunks: ${chunkCount}, length: ${fullContent.length}`)

  return fullContent
}