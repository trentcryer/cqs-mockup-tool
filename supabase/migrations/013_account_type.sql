-- Add account_type (group | customer) to profiles
alter table public.profiles
  add column if not exists account_type text not null default 'group',
  add column if not exists display_name text;

-- Update the new-user trigger to read account_type and display_name from signup metadata
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, quartet_name, group_type, account_type, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'quartet_name', 'My Quartet'),
    coalesce(new.raw_user_meta_data->>'group_type', 'quartet'),
    coalesce(new.raw_user_meta_data->>'account_type', 'group'),
    coalesce(new.raw_user_meta_data->>'display_name', 'Barbershopper')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
