-- ============================================
-- Barber-Feed Social Platform Migration
-- supabase/migrations/012_barber_feed.sql
-- Run in Supabase SQL Editor
-- ============================================

-- Enable UUID extension if not already
create extension if not exists "uuid-ossp";

-- Enum for post content type
create type post_content_type as enum ('image', 'video');

-- 1. barber_feed_posts
create table public.barber_feed_posts (
  id uuid primary key default uuid_generate_v4(),
  group_id uuid not null references public.profiles(id) on delete cascade,
  content_type post_content_type not null,
  media_url text not null,
  media_public_url text,
  caption text,
  product_id bigint,
  product_title text,
  view_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

-- 2. feed_followers
create table public.feed_followers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.profiles(id) on delete cascade,
  followed_at timestamptz not null default now(),
  unique (user_id, group_id)
);

-- 3. feed_post_likes
create table public.feed_post_likes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.barber_feed_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

-- 4. feed_post_shares
create table public.feed_post_shares (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.barber_feed_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);

-- 5. push_subscriptions
create table public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  auth_key text not null,
  p256dh_key text not null,
  created_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

-- 6. notification_preferences (optional)
create table public.notification_preferences (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.profiles(id) on delete cascade,
  muted boolean not null default false,
  unique (user_id, group_id)
);

-- Indexes for performance
create index idx_barber_feed_posts_group on public.barber_feed_posts(group_id);
create index idx_barber_feed_posts_created on public.barber_feed_posts(created_at desc);
create index idx_feed_followers_user on public.feed_followers(user_id);
create index idx_feed_followers_group on public.feed_followers(group_id);
create index idx_feed_post_likes_post on public.feed_post_likes(post_id);
create index idx_feed_post_shares_post on public.feed_post_shares(post_id);

-- RLS Policies
alter table public.barber_feed_posts enable row level security;
alter table public.feed_followers enable row level security;
alter table public.feed_post_likes enable row level security;
alter table public.feed_post_shares enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

-- barber_feed_posts: public read for non-deleted
create policy "Public can read non-deleted posts"
  on public.barber_feed_posts
  for select
  using (is_deleted = false);

-- Groups can insert their own posts
create policy "Groups can insert own posts"
  on public.barber_feed_posts
  for insert
  with check (auth.uid() = group_id);

-- Groups can update own posts
create policy "Groups can update own posts"
  on public.barber_feed_posts
  for update
  using (auth.uid() = group_id);

-- feed_followers: users manage own follows
create policy "Users can manage their own follows"
  on public.feed_followers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- feed_post_likes: users can like/unlike
create policy "Users can manage their own likes"
  on public.feed_post_likes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- feed_post_shares: users can share
create policy "Users can manage their own shares"
  on public.feed_post_shares
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- push_subscriptions: users manage own
create policy "Users can manage their own push subscriptions"
  on public.push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- notification_preferences: users manage own
create policy "Users can manage their own notification preferences"
  on public.notification_preferences
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Updated at trigger for posts
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_barber_feed_posts_updated_at
  before update on public.barber_feed_posts
  for each row execute procedure public.handle_updated_at();

-- Add comment for doc
comment on table public.barber_feed_posts is 'Posts in the Barber-Feed social platform';
comment on table public.feed_followers is 'Retail users following groups for feed and notifications';
comment on table public.feed_post_likes is 'Likes on feed posts';
comment on table public.feed_post_shares is 'Shares on feed posts';
comment on table public.push_subscriptions is 'Web Push subscriptions for notifications';
comment on table public.notification_preferences is 'User preferences for muting group notifications';