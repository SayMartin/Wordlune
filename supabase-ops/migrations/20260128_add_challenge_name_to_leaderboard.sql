-- Update leaderboard_entries view to include challenge name
CREATE OR REPLACE VIEW public.leaderboard_entries AS
SELECT 
  gs.id,
  gs.player_id,
  pp.display_name,
  pp.avatar_url,
  gs.score,
  gs.word,
  gs.guesses_count,
  gs.completed_at,
  gs.challenge_id,
  cc.name as challenge_name
FROM public.game_scores gs
JOIN public.player_profiles pp ON gs.player_id = pp.id
LEFT JOIN public.competitive_challenges cc ON gs.challenge_id = cc.id
WHERE gs.is_public = true AND gs.game_mode = 'competitive';
