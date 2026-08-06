-- Table to track player progress in a challenge
-- Enforces the "One Attempt" rule via UNIQUE constraint
CREATE TABLE IF NOT EXISTS public.challenge_attempts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    player_id UUID REFERENCES public.player_profiles(id) ON DELETE CASCADE NOT NULL,
    challenge_id UUID REFERENCES public.competitive_challenges(id) ON DELETE CASCADE NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'forfeited')),
    progress_index INTEGER DEFAULT 0, -- Number of words completed (0-5)
    total_score INTEGER DEFAULT 0,
    total_duration INTEGER DEFAULT 0,
    UNIQUE(player_id, challenge_id)
);

ALTER TABLE public.challenge_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts"
    ON public.challenge_attempts FOR SELECT
    USING ( auth.uid() = player_id );

CREATE POLICY "Users can insert own attempts"
    ON public.challenge_attempts FOR INSERT
    WITH CHECK ( auth.uid() = player_id );

CREATE POLICY "Users can update own attempts"
    ON public.challenge_attempts FOR UPDATE
    USING ( auth.uid() = player_id );

-- View for the "Select a Challenge" menu
-- Joins challenges with the count of players who have successfully completed them
CREATE OR REPLACE VIEW public.challenge_menu_stats AS
SELECT 
    c.id, 
    c.name, 
    c.difficulty, 
    c.subcategory_ids, -- Array of UUIDs
    COUNT(ca.id) FILTER (WHERE ca.status = 'completed') as completions_count
FROM public.competitive_challenges c
LEFT JOIN public.challenge_attempts ca ON c.id = ca.challenge_id
GROUP BY c.id, c.name, c.difficulty, c.subcategory_ids;
