-- Store user's Facebook page selection and auth token for posting
alter table public.profiles
  add column if not exists facebook_access_token text,
  add column if not exists facebook_page_id text,
  add column if not exists facebook_page_name text,
  add column if not exists instagram_access_token text,
  add column if not exists instagram_account_id text,
  add column if not exists instagram_account_name text;
