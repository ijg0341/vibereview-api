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

export type UserRole = Database['public']['Enums']['user_role']
export type UploadStatus = Database['public']['Enums']['upload_status']