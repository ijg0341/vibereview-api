import { z } from 'zod'

const envSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_KEY: z.string(),
  
  // Server
  PORT: z.coerce.number().default(3001),
  HOST: z.string().default('localhost'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  
  // Upload
  MAX_FILE_SIZE: z.coerce.number().default(52428800), // 50MB
  ALLOWED_MIME_TYPES: z.string().default('application/json,application/jsonl,text/plain,text/csv,application/x-jsonlines'),
  
  // Rate Limiting
  RATE_LIMIT_MAX: z.coerce.number().default(100),
  RATE_LIMIT_WINDOW: z.coerce.number().default(900000), // 15 minutes
})

export type Env = z.infer<typeof envSchema>

export function validateEnv(): Env {
  try {
    return envSchema.parse(process.env)
  } catch (error) {
    console.error('❌ Invalid environment variables:')
    console.error(error)
    process.exit(1)
  }
}