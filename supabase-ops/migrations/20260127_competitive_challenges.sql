-- Create table for Competitive Challenges (pre-determined word sets)
CREATE TABLE IF NOT EXISTS public.competitive_challenges (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    subcategory_ids UUID[], -- For metadata/display
    word_ids UUID[] NOT NULL, -- The ordered list of words in this challenge
    start_date TIMESTAMP WITH TIME ZONE,
    difficulty TEXT DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for challenges
ALTER TABLE public.competitive_challenges ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read challenges (to play them)
CREATE POLICY "Everyone can read challenges"
    ON public.competitive_challenges FOR SELECT
    USING ( true );

-- Policy: Only admin (service_role) can insert/update/delete (implied by default deny for anon/authenticated)


-- Update game_scores to link to challenges and track duration
ALTER TABLE public.game_scores 
ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES public.competitive_challenges(id),
ADD COLUMN IF NOT EXISTS duration_seconds INTEGER DEFAULT 0;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_game_scores_challenge ON public.game_scores(challenge_id);


-- Create Leaderboard View for Challenges
-- Aggregates scores and time for players per challenge
-- Logic:
-- 1. Filter for scores belonging to a challenge (challenge_id IS NOT NULL)
-- 2. Verify we only count scores that are valid for the challenge? 
--    (For now, assume app handles playing the correct words. We just aggregate by challenge_id + player_id)
-- 3. Sum Score (High is good)
-- 4. Sum Duration (Low is good) - Used as tiebreaker
CREATE OR REPLACE VIEW public.challenge_leaderboards AS
SELECT
    gs.challenge_id,
    gs.player_id,
    pp.display_name,
    pp.avatar_url,
    -- Aggregate stats
    SUM(gs.score) as total_score,
    SUM(gs.duration_seconds) as total_duration,
    COUNT(gs.id) as words_completed,
    MAX(gs.completed_at) as last_completed_at
FROM public.game_scores gs
JOIN public.player_profiles pp ON gs.player_id = pp.id
WHERE 
    gs.challenge_id IS NOT NULL 
    AND gs.game_mode = 'competitive'
    AND gs.is_public = true -- Ensure only public scores count
GROUP BY 
    gs.challenge_id, 
    gs.player_id, 
    pp.display_name, 
    pp.avatar_url;
