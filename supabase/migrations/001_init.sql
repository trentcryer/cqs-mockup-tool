-- ============================================
-- CQS Mockup Studio - Supabase Schema (v1)
-- Run this in Supabase SQL Editor or via migrations
-- ============================================

-- Enable required extensions
create extension if not exists "uuid-ossp";

-- ============================================
-- PROFILES (extends auth.users)
-- ============================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  quartet_name text not null default 'My Quartet',
  email text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create profile on new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, quartet_name)
  values (new.id, new.email, 'My Quartet');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================
-- LOGOS (user's reusable logo library)
-- ============================================
create table public.logos (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,           -- e.g. "logos/<user_id>/<uuid>.png"
  filename text not null,
  mime_type text,
  size_bytes int,
  width int,
  height int,
  created_at timestamptz not null default now()
);

create index logos_user_id_idx on public.logos(user_id);

-- ============================================
-- DESIGNS (saved mockup configurations)
-- ============================================
create type design_status as enum ('draft', 'review_requested', 'approved', 'pushed_to_shopify');

create table public.designs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quartet_name text,                     -- snapshot for admin convenience

  -- Printful product info
  product_id integer not null,
  product_title text not null,
  color text,
  placement text not null,               -- e.g. "front", "back"
  variant_ids integer[] not null,        -- Printful variant IDs for the color

  -- Logo + placement transform (the heart of the editor)
  logo_id uuid references public.logos(id) on delete set null,
  logo_path text not null,               -- storage path at time of save (for resilience)
  transform jsonb not null default '{}'::jsonb,
  /* Example transform:
     {
       "left": 420, "top": 380,
       "width": 680, "height": 420,
       "angle": 0,
       "opacity": 1.0,
       "scaleX": 1, "scaleY": 1
     }
  */

  -- User notes / special requests
  notes text,

  -- Workflow state
  status design_status not null default 'draft',

  -- Generated artifacts
  printful_file_id integer,
  mockup_urls jsonb,                     -- [{mockup_url, placement, ...}, ...]
  shopify_product_id bigint,
  shopify_product_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index designs_user_id_idx on public.designs(user_id);
create index designs_status_idx on public.designs(status);
create index designs_product_id_idx on public.designs(product_id);

-- ============================================
-- RLS POLICIES (critical for privacy)
-- ============================================

alter table public.profiles enable row level security;
alter table public.logos enable row level security;
alter table public.designs enable row level security;

-- Profiles: users read/write own only
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Logos: full CRUD for owner
create policy "Users can view own logos"
  on public.logos for select
  using (auth.uid() = user_id);

create policy "Users can insert own logos"
  on public.logos for insert
  with check (auth.uid() = user_id);

create policy "Users can update own logos"
  on public.logos for update
  using (auth.uid() = user_id);

create policy "Users can delete own logos"
  on public.logos for delete
  using (auth.uid() = user_id);

-- Designs: full CRUD for owner
create policy "Users can view own designs"
  on public.designs for select
  using (auth.uid() = user_id);

create policy "Users can insert own designs"
  on public.designs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own designs"
  on public.designs for update
  using (auth.uid() = user_id);

create policy "Users can delete own designs"
  on public.designs for delete
  using (auth.uid() = user_id);

-- Admin access (Trent): service role bypasses RLS.
-- For UI admin we will use service_role key on server only.

-- ============================================
-- STORAGE BUCKET + POLICIES (run in Supabase dashboard or via SQL)
-- ============================================
-- 1. Create bucket "cqs-assets" (private)
-- 2. Then these policies (Storage > Policies)

-- Example (apply via dashboard UI or SQL if using storage.admin):
-- create policy "Users can upload own logos"
--   on storage.objects for insert to authenticated
--   with check (bucket_id = 'cqs-assets' and (storage.foldername(name))[1] = 'logos' and auth.uid()::text = (storage.foldername(name))[2]);

-- Similar for select, update, delete restricted to own folder.

-- ============================================
-- HELPFUL VIEWS (optional, for admin)
-- ============================================
create or replace view public.admin_all_designs as
select
  d.*,
  p.email as user_email,
  p.quartet_name as current_quartet_name
from public.designs d
left join public.profiles p on p.id = d.user_id;

-- (Only service_role should query this view in practice)

comment on table public.designs is 'Core saved mockup designs with full placement + transform data for Printful + Shopify handoff';
comment on table public.logos is 'User uploaded logo assets (PNG/SVG preferred) stored in private Supabase Storage';