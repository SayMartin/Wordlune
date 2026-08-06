create table public.matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  player1_id uuid references auth.users(id),
  player2_id uuid references auth.users(id),
  status text check (status in ('waiting', 'playing', 'finished')) default 'waiting',
  secret_word text,
  winner_id uuid references auth.users(id)
);

-- Enable RLS
alter table public.matches enable row level security;

-- Policies
create policy "Public matches are viewable by everyone"
  on public.matches for select
  using (true);

create policy "Users can create matches"
  on public.matches for insert
  with check (auth.uid() = player1_id);

create policy "Users can update their matches"
  on public.matches for update
  using (auth.uid() in (player1_id, player2_id));

-- Add realtime
alter publication supabase_realtime add table public.matches;
