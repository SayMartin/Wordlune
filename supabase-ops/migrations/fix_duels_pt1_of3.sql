-- A: Ensure table exists and enable RLS
CREATE TABLE IF NOT EXISTS duel_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  player1_id UUID REFERENCES auth.users(id) NOT NULL,
  player2_id UUID REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'waiting',
  secret_word TEXT NOT NULL,
  winner_id UUID REFERENCES auth.users(id),
  language TEXT DEFAULT 'en'
);

ALTER TABLE duel_matches ENABLE ROW LEVEL SECURITY;