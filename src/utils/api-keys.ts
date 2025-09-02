import crypto from 'crypto'
import bcrypt from 'bcryptjs'

export interface GeneratedApiKey {
  key: string // 원본 키 (vr_xxxxx)
  hash: string // 저장용 해시
  preview: string // 표시용 (vr_****...xxxx)
}

// API 키 생성
export function generateApiKey(): GeneratedApiKey {
  // vr_ prefix + 28자리 랜덤 문자열 = 총 31자리
  const randomBytes = crypto.randomBytes(21) // 28 characters when base64url
  const keyBody = randomBytes.toString('base64url').slice(0, 28)
  const key = `vr_${keyBody}`
  
  // 해시 생성 (저장용)
  const hash = bcrypt.hashSync(key, 12)
  
  // 프리뷰 생성 (표시용: vr_****...xxxx)
  const preview = `vr_${'*'.repeat(20)}${key.slice(-4)}`
  
  return {
    key,
    hash,
    preview
  }
}

// API 키 검증
export function verifyApiKey(key: string, hash: string): boolean {
  try {
    return bcrypt.compareSync(key, hash)
  } catch {
    return false
  }
}

// API 키 형식 검증
export function isValidApiKeyFormat(key: string): boolean {
  return /^vr_[A-Za-z0-9_-]{28}$/.test(key)
}

// API 키에서 인증 타입 추출
export function extractAuthType(authHeader: string): { type: 'jwt' | 'apikey'; token: string } | null {
  if (!authHeader) return null
  
  if (authHeader.startsWith('Bearer ')) {
    return {
      type: 'jwt',
      token: authHeader.replace('Bearer ', '')
    }
  }
  
  if (authHeader.startsWith('ApiKey ')) {
    return {
      type: 'apikey', 
      token: authHeader.replace('ApiKey ', '')
    }
  }
  
  return null
}