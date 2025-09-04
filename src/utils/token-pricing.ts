// AI 도구별 토큰 비용 계산 모듈
export interface TokenPricing {
  model: string
  input: number  // USD per token
  output: number // USD per token
}

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cached_tokens?: number
}

export interface CostCalculation {
  input_cost: number
  output_cost: number
  cached_cost: number
  total_cost: number
  tool_name: string
  model: string
}

// AI 도구별 대표 모델 토큰 단가
const DEFAULT_TOKEN_PRICING: Record<string, TokenPricing> = {
  'claude-code': {
    model: 'claude-4-opus',
    input: 15.00 / 1000000,  // $15.00 per 1M input tokens
    output: 75.00 / 1000000  // $75.00 per 1M output tokens
  },
  'gpt': {
    model: 'gpt-5',
    input: 10.00 / 1000000,  // $10.00 per 1M input tokens
    output: 30.00 / 1000000  // $30.00 per 1M output tokens
  },
  'gemini': {
    model: 'gemini-2.0-pro',
    input: 2.50 / 1000000,  // $2.50 per 1M input tokens
    output: 10.00 / 1000000   // $10.00 per 1M output tokens
  }
}

/**
 * 환경변수에서 토큰 단가 가져오기 (오버라이드 가능)
 */
function getTokenPricing(): Record<string, TokenPricing> {
  const envPricing = process.env.TOKEN_PRICING
  if (envPricing) {
    try {
      return JSON.parse(envPricing)
    } catch (error) {
      console.warn('Failed to parse TOKEN_PRICING env var, using defaults')
    }
  }
  return DEFAULT_TOKEN_PRICING
}

/**
 * 특정 AI 도구의 토큰 사용량 비용 계산
 */
export function calculateTokenCost(
  toolName: string, 
  usage: TokenUsage
): CostCalculation {
  const pricing = getTokenPricing()
  const toolPricing = pricing[toolName] || pricing['claude-code'] // fallback

  const input_cost = usage.input_tokens * toolPricing!.input
  const output_cost = usage.output_tokens * toolPricing!.output
  // cached tokens는 일반적으로 더 저렴하거나 무료 (input 토큰 비용의 10%)
  const cached_cost = (usage.cached_tokens || 0) * toolPricing!.input * 0.1
  
  return {
    input_cost,
    output_cost,
    cached_cost,
    total_cost: input_cost + output_cost + cached_cost,
    tool_name: toolName,
    model: toolPricing!.model
  }
}

/**
 * 여러 도구의 토큰 사용량 총 비용 계산
 */
export function calculateTotalCost(
  toolUsages: Array<{ tool_name: string } & TokenUsage>
): {
  total_cost: number
  breakdown: CostCalculation[]
} {
  const breakdown = toolUsages.map(usage => 
    calculateTokenCost(usage.tool_name, usage)
  )
  
  const total_cost = breakdown.reduce((sum, calc) => sum + calc.total_cost, 0)
  
  return {
    total_cost,
    breakdown
  }
}

/**
 * 비용을 읽기 쉬운 형태로 포맷팅
 */
export function formatCost(cost: number): string {
  if (cost < 0.01) {
    return '<$0.01'
  }
  return `$${cost.toFixed(2)}`
}

/**
 * 토큰 수를 읽기 쉬운 형태로 포맷팅
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`
  } else if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`
  }
  return tokens.toString()
}

/**
 * 사용 가능한 AI 도구 목록 조회
 */
export function getAvailableTools(): string[] {
  return Object.keys(getTokenPricing())
}

/**
 * 특정 도구의 모델명 조회
 */
export function getToolModel(toolName: string): string {
  const pricing = getTokenPricing()
  return pricing[toolName]?.model || 'unknown'
}