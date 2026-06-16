-- Add group_type (quartet | chorus) to profiles
alter table public.profiles
  add column if not exists group_type text not null default 'quartet';

-- Update the new-user trigger to read quartet_name and group_type from signup metadata.
-- Drop and recreate (rather than OR REPLACE) to avoid ownership issues in Supabase.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, quartet_name, group_type)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'quartet_name', 'My Quartet'),
    coalesce(new.raw_user_meta_data->>'group_type', 'quartet')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
