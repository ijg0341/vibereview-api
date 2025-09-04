// 대시보드 통계 데이터 집계 유틸리티
import { SupabaseClient } from '@supabase/supabase-js'
import { calculateTokenCost, calculateTotalCost, formatTokens } from './token-pricing.js'

export interface PersonalStats {
  date: string
  total_tokens: number
  input_tokens: number
  output_tokens: number
  cached_tokens: number
  estimated_cost: number
  prompt_count: number
  message_chars: number
  tool_breakdown: Array<{
    tool_name: string
    tokens: number
    cost: number
    model: string
  }>
}

export interface TeamTotalStats {
  date: string
  total_tokens: number
  input_tokens: number
  output_tokens: number
  cached_tokens: number
  estimated_cost: number
  prompt_count: number
  message_chars: number
  session_count: number
  active_members: number
  tool_breakdown: Array<{
    tool_name: string
    tokens: number
    cost: number
    model: string
  }>
}

export interface TeamRankingUser {
  rank: number
  user_id: string
  user_name: string
  user_email: string
  value: number
  formatted_value: string
  estimated_cost?: number
}

export interface TeamRankings {
  date: string
  token_ranking: TeamRankingUser[]
  prompt_ranking: TeamRankingUser[]
  message_ranking: TeamRankingUser[]
  // AI 활용 능력 지표 랭킹들
  cost_efficiency_ranking: TeamRankingUser[]   // 비용 효율성 (1달러당 토큰량)
  prompt_quality_ranking: TeamRankingUser[]    // 프롬프트 품질 지수
  overall_ai_score_ranking: TeamRankingUser[]  // 종합 AI 활용도 점수
}

/**
 * 팀 전체 일별 통계 조회
 */
export async function getTeamTotalStats(
  supabase: SupabaseClient,
  teamId: string,
  date: string
): Promise<TeamTotalStats> {
  // 1. 팀 멤버 목록 조회
  const { data: teamMembers, error: membersError } = await supabase
    .from('profiles')
    .select('id')
    .eq('team_id', teamId)
    .eq('is_active', true)

  if (membersError) {
    throw new Error(`Failed to fetch team members: ${membersError.message}`)
  }

  if (!teamMembers || teamMembers.length === 0) {
    return {
      date,
      total_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      estimated_cost: 0,
      prompt_count: 0,
      message_chars: 0,
      session_count: 0,
      active_members: 0,
      tool_breakdown: []
    }
  }

  const memberIds = teamMembers.map(m => m.id)

  // 2. 해당 날짜의 팀 전체 통계 조회
  const { data: dailyStats, error: statsError } = await supabase
    .from('daily_stats')
    .select(`
      user_id,
      tool_name,
      total_input_tokens,
      total_output_tokens,
      total_cached_tokens,
      total_prompt_count,
      total_prompt_chars,
      session_count
    `)
    .eq('date', date)
    .in('user_id', memberIds)

  if (statsError) {
    throw new Error(`Failed to fetch team daily stats: ${statsError.message}`)
  }

  // 3. 통계 집계 (도구별로 합산)
  const toolStatsMap = new Map<string, {
    total_input_tokens: number
    total_output_tokens: number
    total_cached_tokens: number
    total_prompt_count: number
    total_prompt_chars: number
    session_count: number
  }>()

  for (const stat of dailyStats || []) {
    const toolName = stat.tool_name
    
    if (!toolStatsMap.has(toolName)) {
      toolStatsMap.set(toolName, {
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_cached_tokens: 0,
        total_prompt_count: 0,
        total_prompt_chars: 0,
        session_count: 0
      })
    }

    const toolStat = toolStatsMap.get(toolName)!
    toolStat.total_input_tokens += stat.total_input_tokens
    toolStat.total_output_tokens += stat.total_output_tokens
    toolStat.total_cached_tokens += stat.total_cached_tokens
    toolStat.total_prompt_count += stat.total_prompt_count
    toolStat.total_prompt_chars += stat.total_prompt_chars
    toolStat.session_count += stat.session_count
  }

  // 4. 도구별 통계 및 비용 계산
  const toolBreakdown = Array.from(toolStatsMap.entries()).map(([toolName, stat]) => {
    const cost = calculateTokenCost(toolName, {
      input_tokens: stat.total_input_tokens,
      output_tokens: stat.total_output_tokens,
      cached_tokens: stat.total_cached_tokens
    })

    return {
      tool_name: toolName,
      tokens: stat.total_input_tokens + stat.total_output_tokens,
      cost: cost.total_cost,
      model: cost.model
    }
  })

  // 5. 전체 통계 합계
  const totalInputTokens = Array.from(toolStatsMap.values()).reduce((sum, stat) => sum + stat.total_input_tokens, 0)
  const totalOutputTokens = Array.from(toolStatsMap.values()).reduce((sum, stat) => sum + stat.total_output_tokens, 0)
  const totalCachedTokens = Array.from(toolStatsMap.values()).reduce((sum, stat) => sum + stat.total_cached_tokens, 0)
  const totalPromptCount = Array.from(toolStatsMap.values()).reduce((sum, stat) => sum + stat.total_prompt_count, 0)
  const totalMessageChars = Array.from(toolStatsMap.values()).reduce((sum, stat) => sum + stat.total_prompt_chars, 0)
  const totalSessionCount = Array.from(toolStatsMap.values()).reduce((sum, stat) => sum + stat.session_count, 0)

  // 활동한 멤버 수 (해당 날짜에 데이터가 있는 멤버)
  const activeMemberIds = new Set(dailyStats?.map(stat => stat.user_id))
  const activeMembersCount = activeMemberIds.size

  // 총 비용 계산
  const totalCost = toolBreakdown.reduce((sum, tool) => sum + tool.cost, 0)

  return {
    date,
    total_tokens: totalInputTokens + totalOutputTokens,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    cached_tokens: totalCachedTokens,
    estimated_cost: totalCost,
    prompt_count: totalPromptCount,
    message_chars: totalMessageChars,
    session_count: totalSessionCount,
    active_members: activeMembersCount,
    tool_breakdown: toolBreakdown
  }
}

/**
 * 특정 사용자의 일별 개인 통계 조회
 */
export async function getPersonalStats(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<PersonalStats> {
  // daily_stats에서 해당 날짜 데이터 조회
  const { data: dailyStats, error } = await supabase
    .from('daily_stats')
    .select(`
      tool_name,
      total_input_tokens,
      total_output_tokens, 
      total_cached_tokens,
      total_prompt_count,
      total_prompt_chars,
      session_count
    `)
    .eq('user_id', userId)
    .eq('date', date)

  if (error) {
    throw new Error(`Failed to fetch personal stats: ${error.message}`)
  }

  // 데이터가 없으면 빈 통계 반환
  if (!dailyStats || dailyStats.length === 0) {
    return {
      date,
      total_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      cached_tokens: 0,
      estimated_cost: 0,
      prompt_count: 0,
      message_chars: 0,
      tool_breakdown: []
    }
  }

  // 도구별 통계 집계
  const toolBreakdown = dailyStats.map(stat => {
    const cost = calculateTokenCost(stat.tool_name, {
      input_tokens: stat.total_input_tokens,
      output_tokens: stat.total_output_tokens,
      cached_tokens: stat.total_cached_tokens
    })

    return {
      tool_name: stat.tool_name,
      tokens: stat.total_input_tokens + stat.total_output_tokens,
      cost: cost.total_cost,
      model: cost.model
    }
  })

  // 전체 통계 합계
  const totalInputTokens = dailyStats.reduce((sum, stat) => sum + stat.total_input_tokens, 0)
  const totalOutputTokens = dailyStats.reduce((sum, stat) => sum + stat.total_output_tokens, 0)
  const totalCachedTokens = dailyStats.reduce((sum, stat) => sum + stat.total_cached_tokens, 0)
  const totalPromptCount = dailyStats.reduce((sum, stat) => sum + stat.total_prompt_count, 0)
  const totalMessageChars = dailyStats.reduce((sum, stat) => sum + stat.total_prompt_chars, 0)

  // 총 비용 계산
  const totalCostCalc = calculateTotalCost(
    dailyStats.map(stat => ({
      tool_name: stat.tool_name,
      input_tokens: stat.total_input_tokens,
      output_tokens: stat.total_output_tokens,
      cached_tokens: stat.total_cached_tokens
    }))
  )

  return {
    date,
    total_tokens: totalInputTokens + totalOutputTokens,
    input_tokens: totalInputTokens,
    output_tokens: totalOutputTokens,
    cached_tokens: totalCachedTokens,
    estimated_cost: totalCostCalc.total_cost,
    prompt_count: totalPromptCount,
    message_chars: totalMessageChars,
    tool_breakdown: toolBreakdown
  }
}

/**
 * 팀 내 일별 랭킹 조회 (간단한 쿼리들로 분리)
 */
export async function getTeamRankings(
  supabase: SupabaseClient,
  teamId: string,
  date: string
): Promise<TeamRankings> {
  // 1. 팀 멤버 목록 조회
  const { data: teamMembers, error: membersError } = await supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      username
    `)
    .eq('team_id', teamId)
    .eq('is_active', true)

  if (membersError) {
    throw new Error(`Failed to fetch team members: ${membersError.message}`)
  }

  if (!teamMembers || teamMembers.length === 0) {
    return {
      date,
      token_ranking: [],
      prompt_ranking: [],
      message_ranking: [],
      cost_efficiency_ranking: [],
      prompt_quality_ranking: [],
      overall_ai_score_ranking: []
    }
  }

  const memberIds = teamMembers.map(m => m.id)

  // 2. 해당 날짜의 팀 멤버 통계 조회
  const { data: dailyStats, error: statsError } = await supabase
    .from('daily_stats')
    .select(`
      user_id,
      tool_name,
      total_input_tokens,
      total_output_tokens,
      total_cached_tokens,
      total_prompt_count,
      total_prompt_chars,
      session_count
    `)
    .eq('date', date)
    .in('user_id', memberIds)

  if (statsError) {
    throw new Error(`Failed to fetch daily stats: ${statsError.message}`)
  }

  // 3. auth.users에서 이메일 정보 조회
  const { data: userEmails, error: emailsError } = await supabase
    .auth
    .admin
    .listUsers()

  if (emailsError) {
    throw new Error(`Failed to fetch user emails: ${emailsError.message}`)
  }

  // 이메일 맵 생성
  const emailMap = new Map<string, string>()
  userEmails.users.forEach(user => {
    emailMap.set(user.id, user.email || 'Unknown')
  })

  // 4. 사용자별 통계 집계
  const userStatsMap = new Map<string, {
    user_id: string
    user_name: string
    user_email: string
    total_tokens: number
    input_tokens: number
    output_tokens: number
    total_prompts: number
    total_chars: number
    session_count: number
    estimated_cost: number
  }>()

  // 팀 멤버들 초기화
  for (const member of teamMembers) {
    userStatsMap.set(member.id, {
      user_id: member.id,
      user_name: member.full_name || member.username || 'Unknown',
      user_email: emailMap.get(member.id) || 'Unknown',
      total_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_prompts: 0,
      total_chars: 0,
      session_count: 0,
      estimated_cost: 0
    })
  }

  // 통계 데이터 집계
  for (const stat of dailyStats || []) {
    const userStat = userStatsMap.get(stat.user_id)
    if (!userStat) continue

    const cost = calculateTokenCost(stat.tool_name, {
      input_tokens: stat.total_input_tokens,
      output_tokens: stat.total_output_tokens,
      cached_tokens: stat.total_cached_tokens
    })

    userStat.total_tokens += stat.total_input_tokens + stat.total_output_tokens
    userStat.input_tokens += stat.total_input_tokens
    userStat.output_tokens += stat.total_output_tokens
    userStat.total_prompts += stat.total_prompt_count
    userStat.total_chars += stat.total_prompt_chars
    userStat.session_count += stat.session_count
    userStat.estimated_cost += cost.total_cost
  }

  const userStats = Array.from(userStatsMap.values())
    .filter(user => user.total_tokens > 0 || user.total_prompts > 0) // 활동이 있는 사용자만

  // 사용자별 AI 활용 능력 지표 계산
  const enrichedUserStats = userStats.map(user => {
    // 비용 효율성: 1달러당 얻은 토큰량
    const costEfficiency = user.estimated_cost > 0 ? user.total_tokens / user.estimated_cost : 0
    
    // 프롬프트 품질 지수: (출력/입력) * 프롬프트수 (좋은 질문을 많이 한 사람)
    const promptQuality = user.input_tokens > 0 && user.total_prompts > 0 
      ? (user.output_tokens / user.input_tokens) * user.total_prompts 
      : 0
    
    // 종합 AI 활용도: 토큰량(40%) + 프롬프트수(30%) + 메시지량(30%)
    const overallScore = (user.total_tokens * 0.4) + (user.total_prompts * 100 * 0.3) + (user.total_chars * 0.3)

    return {
      ...user,
      cost_efficiency: costEfficiency,
      prompt_quality: promptQuality,
      overall_score: overallScore
    }
  })

  // 토큰 사용량 랭킹 TOP 20
  const tokenRanking = enrichedUserStats
    .sort((a, b) => b.total_tokens - a.total_tokens)
    .slice(0, 20)
    .map((user, index) => ({
      rank: index + 1,
      user_id: user.user_id,
      user_name: user.user_name,
      user_email: user.user_email,
      value: user.total_tokens,
      formatted_value: formatTokens(user.total_tokens),
      estimated_cost: user.estimated_cost
    }))

  // 프롬프트 횟수 랭킹 TOP 20
  const promptRanking = enrichedUserStats
    .sort((a, b) => b.total_prompts - a.total_prompts)
    .slice(0, 20)
    .map((user, index) => ({
      rank: index + 1,
      user_id: user.user_id,
      user_name: user.user_name,
      user_email: user.user_email,
      value: user.total_prompts,
      formatted_value: user.total_prompts.toString()
    }))

  // 메시지량 랭킹 TOP 20
  const messageRanking = enrichedUserStats
    .sort((a, b) => b.total_chars - a.total_chars)
    .slice(0, 20)
    .map((user, index) => ({
      rank: index + 1,
      user_id: user.user_id,
      user_name: user.user_name,
      user_email: user.user_email,
      value: user.total_chars,
      formatted_value: formatMessageChars(user.total_chars)
    }))

  // 비용 효율성 랭킹 TOP 20 (1달러당 토큰량)
  const costEfficiencyRanking = enrichedUserStats
    .filter(user => user.estimated_cost > 0)
    .sort((a, b) => b.cost_efficiency - a.cost_efficiency)
    .slice(0, 20)
    .map((user, index) => ({
      rank: index + 1,
      user_id: user.user_id,
      user_name: user.user_name,
      user_email: user.user_email,
      value: Math.round(user.cost_efficiency),
      formatted_value: `${Math.round(user.cost_efficiency).toLocaleString()}토큰/$1`
    }))

  // 프롬프트 품질 지수 랭킹 TOP 20
  const promptQualityRanking = enrichedUserStats
    .filter(user => user.input_tokens > 0 && user.total_prompts > 0)
    .sort((a, b) => b.prompt_quality - a.prompt_quality)
    .slice(0, 20)
    .map((user, index) => ({
      rank: index + 1,
      user_id: user.user_id,
      user_name: user.user_name,
      user_email: user.user_email,
      value: Math.round(user.prompt_quality),
      formatted_value: `${Math.round(user.prompt_quality).toLocaleString()}점`
    }))

  // 종합 AI 활용도 랭킹 TOP 20
  const overallAiScoreRanking = enrichedUserStats
    .sort((a, b) => b.overall_score - a.overall_score)
    .slice(0, 20)
    .map((user, index) => ({
      rank: index + 1,
      user_id: user.user_id,
      user_name: user.user_name,
      user_email: user.user_email,
      value: Math.round(user.overall_score),
      formatted_value: `${Math.round(user.overall_score).toLocaleString()}점`
    }))

  return {
    date,
    token_ranking: tokenRanking,
    prompt_ranking: promptRanking,
    message_ranking: messageRanking,
    cost_efficiency_ranking: costEfficiencyRanking,
    prompt_quality_ranking: promptQualityRanking,
    overall_ai_score_ranking: overallAiScoreRanking
  }
}

/**
 * 사용자의 팀 ID 조회
 */
export async function getUserTeamId(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('team_id')
    .eq('id', userId)
    .eq('is_active', true)
    .single()

  if (error || !profile?.team_id) {
    throw new Error(`Failed to get user team: ${error?.message || 'No team found'}`)
  }

  return profile.team_id
}

/**
 * 팀 멤버 여부 확인
 */
export async function verifyTeamMember(
  supabase: SupabaseClient,
  userId: string,
  teamId: string
): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('team_id', teamId)
    .eq('is_active', true)
    .single()

  return !!profile
}

/**
 * 메시지 문자수를 읽기 쉽게 포맷팅
 */
function formatMessageChars(chars: number): string {
  if (chars >= 1000000) {
    return `${(chars / 1000000).toFixed(1)}M`
  } else if (chars >= 1000) {
    return `${(chars / 1000).toFixed(1)}K`
  }
  return chars.toString()
}

/**
 * 날짜 유효성 검증
 */
export function validateDate(dateString: string): boolean {
  const date = new Date(dateString)
  return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/) !== null
}