-- Create Game Scores table
create table if not exists public.game_scores (
  id uuid default gen_random_uuid() primary key,
  player_id uuid references public.player_profiles(id) on delete cascade not null,
  score integer not null, -- Can be calculated based on difficulty/guesses
  word text,
  is_always_five_letters boolean default false,
  max_letters integer,
  guesses_count integer,
  completed_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.game_scores enable row level security;

-- Policies for Scores
-- 1. Everyone can read scores (needed for leaderboard)
create policy "Everyone can view game scores"
  on public.game_scores for select
  using ( true );

-- 2. Authenticated users can insert their own scores
create policy "Users can insert own scores"
  on public.game_scores for insert
  with check ( auth.uid() = player_id );

-- View for Leaderboard (aggregating best scores or most wins)
-- Let's stick to a simple query in the app for now, or a view helper.
-- A view helps join with profile data easily.
create or replace view public.leaderboard_entries as
select 
  gs.id,
  gs.player_id,
  pp.display_name,
  pp.avatar_url,
  gs.score,
  gs.word,
  gs.guesses_count,
  gs.completed_at
from public.game_scores gs
join public.player_profiles pp on gs.player_id = pp.id
where pp.is_public = true; -- Only show scores for public profiles
