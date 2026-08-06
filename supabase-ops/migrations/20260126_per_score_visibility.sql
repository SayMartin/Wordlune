-- Add is_public column to game_scores
ALTER TABLE public.game_scores 
ADD COLUMN IF NOT EXISTS is_public boolean DEFAULT false;

-- Migrate existing data: Score is public if the Player Profile was public AND it is a competitive game
UPDATE public.game_scores gs
SET is_public = (
    SELECT is_public 
    FROM public.player_profiles pp 
    WHERE pp.id = gs.player_id
)
WHERE game_mode = 'competitive';

-- Ensure practice games are always private
UPDATE public.game_scores
SET is_public = false
WHERE game_mode != 'competitive';

-- Update the leaderboard view to respect game_scores.is_public instead of profile.is_public
CREATE OR REPLACE VIEW public.leaderboard_entries AS
SELECT 
  gs.id,
  gs.player_id,
  pp.display_name,
  pp.avatar_url,
  gs.score,
  gs.word,
  gs.guesses_count,
  gs.completed_at
FROM public.game_scores gs
JOIN public.player_profiles pp ON gs.player_id = pp.id
WHERE gs.is_public = true AND gs.game_mode = 'competitive';

-- Update RLS policy for updating scores (if not already existing)
-- Users should be able to update their own scores (e.g. toggling visibility)
DROP POLICY IF EXISTS "Users can update own scores" ON public.game_scores;
CREATE POLICY "Users can update own scores"
  ON public.game_scores FOR UPDATE
  USING ( auth.uid() = player_id )
  WITH CHECK ( auth.uid() = player_id );
