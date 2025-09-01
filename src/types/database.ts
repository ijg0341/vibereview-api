// Generated database types - will be updated when we have actual Supabase setup
export interface Database {
  public: {
    Tables: {
      teams: {
        Row: {
          id: string
          name: string
          slug: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
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
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          team_id?: string | null
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          team_id?: string | null
          full_name?: string | null
          username?: string | null
          avatar_url?: string | null
          role?: string
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
          upload_status: string
          processing_error: string | null
          metadata: any | null
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
          upload_status?: string
          processing_error?: string | null
          metadata?: any | null
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
          upload_status?: string
          processing_error?: string | null
          metadata?: any | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}