
-- Create table for Competitive Challenge Results
CREATE TABLE IF NOT EXISTS public.challenge_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES public.player_profiles(id) ON DELETE CASCADE NOT NULL,
    challenge_id UUID REFERENCES public.competitive_challenges(id) ON DELETE CASCADE NOT NULL,
    total_score INTEGER NOT NULL,
    total_duration INTEGER NOT NULL, -- in seconds
    total_guesses INTEGER DEFAULT 0,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.challenge_results ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Everyone can read challenge results"
  ON public.challenge_results FOR SELECT
  USING ( true );

CREATE POLICY "Users can insert own challenge results"
  ON public.challenge_results FOR INSERT
  WITH CHECK ( auth.uid() = player_id );

-- Create a unified view for Player History
-- Combines Practice Games (from game_scores) and Competitive Challenges (from challenge_results)
CREATE OR REPLACE VIEW public.player_history_view AS
SELECT
    gs.id,
    gs.player_id,
    'practice' as mode,
    gs.score,
    gs.duration_seconds,
    gs.word as description, -- usage: "Word: [word]"
    gs.completed_at
FROM public.game_scores gs
WHERE gs.game_mode = 'practice'

UNION ALL

SELECT
    cr.id,
    cr.player_id,
    'competitive' as mode,
    cr.total_score as score,
    cr.total_duration as duration_seconds,
    cc.name as description, -- usage: "Challenge: [Name]"
    cr.completed_at
FROM public.challenge_results cr
LEFT JOIN public.competitive_challenges cc ON cr.challenge_id = cc.id;

-- Update Leaderboard View to use the new table
-- We only start using this view for challenges now
CREATE OR REPLACE VIEW public.challenge_leaderboards AS
SELECT
    cr.challenge_id,
    cr.player_id,
    pp.display_name,
    pp.avatar_url,
    MAX(cr.total_score) as total_score, -- Max score if they replayed? Or SUM? usually challenges are one-off or best score. logic: Best Score.
    MIN(cr.total_duration) as total_duration, -- Tie breaker
    COUNT(cr.id) as completions_count,
    MAX(cr.completed_at) as last_completed_at
FROM public.challenge_results cr
JOIN public.player_profiles pp ON cr.player_id = pp.id
WHERE pp.is_public = true -- Only public profiles
GROUP BY 
    cr.challenge_id, 
    cr.player_id, 
    pp.display_name, 
    pp.avatar_url;
