-- Update leaderboard_entries view to query from challenge_results instead of game_scores
-- This ensures the global leaderboard reflects the new competitive system and is_public setting

CREATE OR REPLACE VIEW public.leaderboard_entries AS
SELECT 
  cr.id,
  cr.player_id,
  pp.display_name,
  pp.avatar_url,
  cr.total_score as score,
  NULL::text as word, -- Placeholder for compatibility
  cr.total_guesses as guesses_count,
  cr.completed_at,
  cr.challenge_id,
  cc.name as challenge_name
FROM public.challenge_results cr
JOIN public.player_profiles pp ON cr.player_id = pp.id
JOIN public.competitive_challenges cc ON cr.challenge_id = cc.id
WHERE cr.is_public = true;
