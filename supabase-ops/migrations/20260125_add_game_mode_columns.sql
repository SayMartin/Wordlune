-- Add game_mode and seed columns to game_scores
-- Run this migration to enable filtering scores by mode (practice vs competitive)

ALTER TABLE public.game_scores 
ADD COLUMN IF NOT EXISTS game_mode text DEFAULT 'practice',
ADD COLUMN IF NOT EXISTS seed text,
ADD COLUMN IF NOT EXISTS is_always_five_letters boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS max_letters integer,
ADD COLUMN IF NOT EXISTS guesses_count integer,
ADD COLUMN IF NOT EXISTS language text DEFAULT 'en';

-- Add index for faster filtering by mode
CREATE INDEX IF NOT EXISTS idx_game_scores_mode ON public.game_scores(game_mode);
CREATE INDEX IF NOT EXISTS idx_game_scores_player_mode ON public.game_scores(player_id, game_mode);
