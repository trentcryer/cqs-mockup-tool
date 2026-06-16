-- Extensible admin flag (replaces hardcoded TRENT_EMAIL comparison for API routes)
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

update public.profiles set is_admin = true where email ilike 'trentcryer@gmail.com';
