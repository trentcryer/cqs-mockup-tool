-- Barber-Feed: Social platform for barbershop harmony groups and fans

-- Posts table: Group content (images/videos)
create table if not exists public.barber_feed_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.profiles(id) on delete cascade,
  content_type text not null check (content_type in ('image', 'video')),
  media_url text not null, -- Storage path in cqs-assets
  media_public_url text, -- Signed URL or public URL
  caption text,
  product_id bigint, -- Shopify product ID, nullable
  product_title text, -- Snapshot of product name
  view_count int not null default 0,
  like_count int not null default 0,
  share_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_deleted boolean not null default false
);

-- Followers: Retail users following groups
create table if not exists public.feed_followers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.profiles(id) on delete cascade,
  followed_at timestamptz not null default now(),
  unique(user_id, group_id)
);

-- Post likes
create table if not exists public.feed_post_likes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.barber_feed_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);

-- Post shares
create table if not exists public.feed_post_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.barber_feed_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);

-- Web Push subscriptions for notifications
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null, -- Web Push endpoint URL
  auth_key text not null, -- Encryption key
  p256dh_key text not null, -- Encryption key
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

-- User notification preferences (mute groups)
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.profiles(id) on delete cascade,
  muted boolean not null default false,
  unique(user_id, group_id)
);

-- Enable RLS
alter table public.barber_feed_posts enable row level security;
alter table public.feed_followers enable row level security;
alter table public.feed_post_likes enable row level security;
alter table public.feed_post_shares enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;

-- RLS Policies for barber_feed_posts
create policy "Posts are publicly readable"
  on public.barber_feed_posts for select
  using (true);

create policy "Groups can insert own posts"
  on public.barber_feed_posts for insert
  with check (group_id = auth.uid());

create policy "Groups can update own posts"
  on public.barber_feed_posts for update
  using (group_id = auth.uid());

create policy "Groups can delete own posts"
  on public.barber_feed_posts for delete
  using (group_id = auth.uid());

-- RLS for followers
create policy "Users manage own follows"
  on public.feed_followers for all
  using (user_id = auth.uid());

-- RLS for likes
create policy "Users manage own likes"
  on public.feed_post_likes for all
  using (user_id = auth.uid());

-- RLS for shares
create policy "Users manage own shares"
  on public.feed_post_shares for all
  using (user_id = auth.uid());

-- RLS for push subscriptions
create policy "Users manage own subscriptions"
  on public.push_subscriptions for all
  using (user_id = auth.uid());

-- RLS for notification preferences
create policy "Users manage own preferences"
  on public.notification_preferences for all
  using (user_id = auth.uid());

-- Indexes for performance
create index idx_barber_feed_posts_group_id on public.barber_feed_posts(group_id);
create index idx_barber_feed_posts_created_at on public.barber_feed_posts(created_at desc);
create index idx_barber_feed_posts_is_deleted on public.barber_feed_posts(is_deleted);
create index idx_feed_followers_user_id on public.feed_followers(user_id);
create index idx_feed_followers_group_id on public.feed_followers(group_id);
create index idx_feed_post_likes_post_id on public.feed_post_likes(post_id);
create index idx_feed_post_likes_user_id on public.feed_post_likes(user_id);
create index idx_feed_post_shares_post_id on public.feed_post_shares(post_id);
create index idx_feed_post_shares_user_id on public.feed_post_shares(user_id);
create index idx_push_subscriptions_user_id on public.push_subscriptions(user_id);
