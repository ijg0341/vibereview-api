import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// 기존 비스트리밍 방식 (하위 호환)
export async function generateWithClaude(prompt: string): Promise<string> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is required')
  }

  const response = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
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
        role: "user",
        content: prompt,
      },
    ],
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