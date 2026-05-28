// Minimal Database types for CQS Studio
// For full types: npx supabase gen types typescript --project-id <your-id> > types/supabase.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          quartet_name: string
          email: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          quartet_name?: string
          email?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          quartet_name?: string
          email?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      logos: {
        Row: {
          id: string
          user_id: string
          storage_path: string
          filename: string
          mime_type: string | null
          size_bytes: number | null
          width: number | null
          height: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          storage_path: string
          filename: string
          mime_type?: string | null
          size_bytes?: number | null
          width?: number | null
          height?: number | null
        }
        Update: {
          filename?: string
        }
      }
      designs: {
        Row: {
          id: string
          user_id: string
          quartet_name: string | null
          product_id: number
          product_title: string
          color: string | null
          placement: string
          variant_ids: number[]
          logo_id: string | null
          logo_path: string
          transform: Json
          notes: string | null
          status: 'draft' | 'review_requested' | 'approved' | 'pushed_to_shopify'
          printful_file_id: number | null
          mockup_urls: Json | null
          shopify_product_id: number | null
          shopify_product_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          quartet_name?: string | null
          product_id: number
          product_title: string
          color?: string | null
          placement: string
          variant_ids: number[]
          logo_id?: string | null
          logo_path: string
          transform?: Json
          notes?: string | null
          status?: 'draft' | 'review_requested' | 'approved' | 'pushed_to_shopify'
        }
        Update: {
          quartet_name?: string | null
          color?: string | null
          placement?: string
          transform?: Json
          notes?: string | null
          status?: 'draft' | 'review_requested' | 'approved' | 'pushed_to_shopify'
          printful_file_id?: number | null
          mockup_urls?: Json | null
          shopify_product_id?: number | null
          shopify_product_url?: string | null
          updated_at?: string
        }
      }
    }
  }
}

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Logo = Database['public']['Tables']['logos']['Row']
export type Design = Database['public']['Tables']['designs']['Row']
export type DesignStatus = Design['status']