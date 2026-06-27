// Enhanced social types for Barber-Feed and multi-platform promotion
// Matches CQS conventions: strict types, no any

export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok' | 'x' | 'linkedin' | 'barber-feed';

export interface SocialConnection {
  id: string;
  group_id: string;
  platform: SocialPlatform;
  account_id: string;
  page_id?: string;
  display_name: string;
  avatar_url?: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  is_default: boolean;
  connected_at: string;
  last_used_at?: string;
  scopes?: string[];
}

export interface PromotionPost {
  title: string;
  caption: string;
  media_url: string;
  product_id?: number;
  product_title?: string;
  platforms: SocialPlatform[]; // Multiple platforms to share to
  scheduled_for?: string;
}

export interface PostResult {
  platform: SocialPlatform;
  success: boolean;
  post_id?: string;
  error?: string;
  share_url?: string;
}

// Barber-Feed specific extensions (merged from barber-feed.ts for convenience)
export type PostContentType = 'image' | 'video';

export interface BarberFeedPost {
  id: string;
  group_id: string;
  group_name: string;
  group_avatar_url?: string;
  content_type: PostContentType;
  media_url: string;
  media_public_url?: string;
  caption?: string;
  product_id?: number;
  product_title?: string;
  product_link?: string;
  view_count: number;
  like_count: number;
  share_count: number;
  liked_by_user: boolean;
  shared_by_user: boolean;
  created_at: string;
  updated_at: string;
}

export interface FeedFollower {
  id: string;
  user_id: string;
  group_id: string;
  group_name: string;
  group_avatar_url?: string;
  followed_at: string;
}

export interface PostLike {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface PostShare {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
}

export interface PushSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  auth_key: string;
  p256dh_key: string;
  created_at: string;
}

export interface NotificationPreference {
  id: string;
  user_id: string;
  group_id: string;
  muted: boolean;
}

export interface FeedFetchParams {
  limit: number;
  offset: number;
  user_id?: string;
}

export interface BarberFeedResponse {
  posts: BarberFeedPost[];
  total_count: number;
  has_more: boolean;
}
