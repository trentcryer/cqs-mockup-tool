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
  user_id?: string; // For liked/followed status
}

export interface BarberFeedResponse {
  posts: BarberFeedPost[];
  total_count: number;
  has_more: boolean;
}
