// Database types generated from actual Supabase schema
export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          max_members: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          max_members?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          max_members?: number
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          team_id: string | null
          full_name: string | null
          username: string | null
          avatar_url: string | null
          role: 'admin' | 'member'
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          team_id?: string | null
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
          role?: 'admin' | 'member'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
          role?: 'admin' | 'member'
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      uploaded_files: {
        Row: {
          id: string
          team_id: string
          user_id: string
          original_filename: string
          storage_path: string
          file_size: number
          mime_type: string
          file_hash: string | null
          tool_name: string | null
          session_date: string | null
          upload_status: 'uploaded' | 'processing' | 'processed' | 'failed'
          processing_error: string | null
          metadata: Record<string, any> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          original_filename: string
          storage_path: string
          file_size: number
          mime_type: string
          file_hash?: string | null
          tool_name?: string | null
          session_date?: string | null
          upload_status?: 'uploaded' | 'processing' | 'processed' | 'failed'
          processing_error?: string | null
          metadata?: Record<string, any> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          original_filename?: string
          storage_path?: string
          file_size?: number
          mime_type?: string
          file_hash?: string | null
          tool_name?: string | null
          session_date?: string | null
          upload_status?: 'uploaded' | 'processing' | 'processed' | 'failed'
          processing_error?: string | null
          metadata?: Record<string, any> | null
          created_at?: string
          updated_at?: string
        }
      }
      daily_stats: {
        Row: {
          id: string
          user_id: string
          date: string
          tool_name: string
          session_count: number
          total_prompt_count: number
          total_prompt_chars: number
          total_input_tokens: number
          total_output_tokens: number
          total_cached_tokens: number
          total_duration_minutes: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          date: string
          tool_name: string
          session_count?: number
          total_prompt_count?: number
          total_prompt_chars?: number
          total_input_tokens?: number
          total_output_tokens?: number
          total_cached_tokens?: number
          total_duration_minutes?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          date?: string
          tool_name?: string
          session_count?: number
          total_prompt_count?: number
          total_prompt_chars?: number
          total_input_tokens?: number
          total_output_tokens?: number
          total_cached_tokens?: number
          total_duration_minutes?: number
          created_at?: string
          updated_at?: string
        }
      }
      api_keys: {
        Row: {
          id: string
          user_id: string
          team_id: string
          name: string
          key_hash: string
          key_preview: string
          is_active: boolean
          last_used_at: string | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          team_id: string
          name: string
          key_hash: string
          key_preview: string
          is_active?: boolean
          last_used_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string
          name?: string
          key_hash?: string
          key_preview?: string
          is_active?: boolean
          last_used_at?: string | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      projects: {
        Row: {
          id: string
          team_id: string
          user_id: string
          name: string
          description: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
          name: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
          name?: string
          description?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          team_id: string
          project_id: string | null
          tool_name: string
          session_date: string
          start_time: string
          end_time: string | null
          file_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          team_id: string
          project_id?: string | null
          tool_name: string
          session_date: string
          start_time: string
          end_time?: string | null
          file_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          team_id?: string
          project_id?: string | null
          tool_name?: string
          session_date?: string
          start_time?: string
          end_time?: string | null
          file_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      session_content: {
        Row: {
          id: string
          session_id: string
          messages: ProcessedMessage[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          session_id: string
          messages: ProcessedMessage[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          messages?: ProcessedMessage[]
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      handle_new_user: {
        Args: Record<string, never>
        Returns: undefined
      }
      update_updated_at_column: {
        Args: Record<string, never>
        Returns: undefined
      }
    }
    Enums: {
      user_role: 'admin' | 'member'
      upload_status: 'uploaded' | 'processing' | 'processed' | 'failed'
    }
  }
}

// Convenience types
export type Team = Database['public']['Tables']['teams']['Row']
export type TeamInsert = Database['public']['Tables']['teams']['Insert']
export type TeamUpdate = Database['public']['Tables']['teams']['Update']

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert']
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update']

export type UploadedFile = Database['public']['Tables']['uploaded_files']['Row']
export type UploadedFileInsert = Database['public']['Tables']['uploaded_files']['Insert']
export type UploadedFileUpdate = Database['public']['Tables']['uploaded_files']['Update']

export type ApiKey = Database['public']['Tables']['api_keys']['Row']
export type ApiKeyInsert = Database['public']['Tables']['api_keys']['Insert']
export type ApiKeyUpdate = Database['public']['Tables']['api_keys']['Update']

export type DailyStats = Database['public']['Tables']['daily_stats']['Row']
export type DailyStatsInsert = Database['public']['Tables']['daily_stats']['Insert']
export type DailyStatsUpdate = Database['public']['Tables']['daily_stats']['Update']

export type UserRole = Database['public']['Enums']['user_role']
export type UploadStatus = Database['public']['Enums']['upload_status']

export type Project = Database['public']['Tables']['projects']['Row']
export type ProjectInsert = Database['public']['Tables']['projects']['Insert']
export type ProjectUpdate = Database['public']['Tables']['projects']['Update']

export type Session = Database['public']['Tables']['sessions']['Row']
export type SessionInsert = Database['public']['Tables']['sessions']['Insert']
export type SessionUpdate = Database['public']['Tables']['sessions']['Update']

export type SessionContent = Database['public']['Tables']['session_content']['Row']
export type SessionContentInsert = Database['public']['Tables']['session_content']['Insert']
export type SessionContentUpdate = Database['public']['Tables']['session_content']['Update']

// ProcessedMessage interface for JSONB messages in session_content table
export interface ProcessedMessage {
  sequence: number
  uuid: string
  parent_uuid?: string
  timestamp: string
  type: 'user' | 'assistant'
  content: any
  char_count?: number
  input_tokens?: number
  output_tokens?: number
  has_tool_use?: boolean
  has_thinking?: boolean
  is_sidechain: boolean      // 새로 추가 - 서브에이전트 메시지 여부
  subagent_name?: string     // 새로 추가 - 서브에이전트 이름
}