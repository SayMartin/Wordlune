-- Create a table for public profiles using Supabase patterns
create table if not exists public.player_profiles (
  id uuid references auth.users(id) on delete cascade not null primary key,
  display_name text unique, -- Enforce uniqueness at DB level too
  avatar_url text,
  is_public boolean default false, -- Dedicated column for leaderboard visibility
  metadata jsonb default '{}'::jsonb, -- Flexible storage for other settings
  updated_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Turn on Row Level Security
alter table public.player_profiles enable row level security;

-- Policies
-- Drop existing policies to ensure clean state if re-running
drop policy if exists "Public profiles are viewable by everyone" on public.player_profiles;
drop policy if exists "Users can insert their own profile" on public.player_profiles;
drop policy if exists "Users can update own profile" on public.player_profiles;
drop policy if exists "Users can view own profile" on public.player_profiles;

-- 1. Public profiles are viewable by everyone (for leaderboards etc)
create policy "Public profiles are viewable by everyone"
  on public.player_profiles for select
  using ( is_public = true );

-- 2. Users can insert their own profile
create policy "Users can insert their own profile"
  on public.player_profiles for insert
  with check ( auth.uid() = id );

-- 3. Users can update own profile
create policy "Users can update own profile"
  on public.player_profiles for update
  using ( auth.uid() = id );

-- 4. Users can read own profile (even if private)
create policy "Users can view own profile"
  on public.player_profiles for select
  using ( auth.uid() = id );

-- Set up Trigger for new users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.player_profiles (id, display_name, avatar_url, metadata)
  values (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->'metadata', '{}'::jsonb)
  )
  on conflict (id) do nothing; -- Prevent error if profile already exists
  return new;
end;
$$ language plpgsql security definer;

-- Trigger execution
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
