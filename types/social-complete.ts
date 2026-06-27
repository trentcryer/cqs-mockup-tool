// Complete types for social media posting + barber-feed
export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'x' | 'linkedin' | 'barber-feed'

export interface SocialConnection {
  id: string
  group_id: string
  platform: SocialPlatform
  account_id: string
  page_id?: string
  display_name: string
  avatar_url?: string
  access_token: string
  refresh_token?: string
  token_expires_at?: string
  is_default: boolean
  connected_at: string
  last_used_at?: string
  scopes?: string[]
}

export interface BarberFeedPost {
  id: string
  group_id: string
  group_name: string
  group_avatar_url?: string
  content_type: 'image' | 'video'
  media_url: string
  media_public_url?: string
  caption?: string
  product_id?: number
  product_title?: string
  product_link?: string
  view_count: number
  like_count: number
  share_count: number
  liked_by_user: boolean
  shared_by_user: boolean
  created_at: string
  updated_at: string
}

export interface PostToMultiplePlatforms {
  caption: string
  media_url: string
  content_type: 'image' | 'video'
  product_id?: number
  product_title?: string
  platforms: SocialPlatform[]
}

export interface PostResult {
  platform: SocialPlatform
  success: boolean
  post_id?: string
  share_url?: string
  error?: string
  error_code?: string
}

export interface MultiPlatformPostResponse {
  barber_feed_post_id?: string
  results: PostResult[]
  posted_at: string
}

export interface PromotionComposerState {
  caption: string
  media_file?: File
  media_preview_url?: string
  product_id?: number
  selected_platforms: SocialPlatform[]
  is_uploading: boolean
  error?: string
}
