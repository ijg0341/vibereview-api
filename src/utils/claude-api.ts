import fetch from 'node-fetch'

interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ClaudeRequest {
  model: string
  max_tokens: number
  messages: ClaudeMessage[]
}

interface ClaudeResponse {
  content: Array<{
    type: string
    text: string
  }>
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

export async function generateWithClaude(prompt: string): Promise<string> {
  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY
  
  if (!CLAUDE_API_KEY) {
    throw new Error('CLAUDE_API_KEY environment variable is required')
  }

  const requestBody: ClaudeRequest = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 4000,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorData = await response.text()
    console.error('Claude API error details:', errorData)
    throw new Error(`Claude API error: ${response.status} - ${errorData}`)
  }

  const data = await response.json() as ClaudeResponse
  return data.content[0]?.text || 'No response from Claude'
}