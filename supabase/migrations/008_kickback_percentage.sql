alter table public.profiles
  add column if not exists kickback_percentage numeric not null default 0;
