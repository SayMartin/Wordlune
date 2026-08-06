-- Create a view for Duel Leaderboard (Top Wins)
CREATE OR REPLACE VIEW public.duel_leaderboard AS
SELECT 
  dm.winner_id as player_id,
  pp.display_name,
  pp.avatar_url,
  COUNT(dm.id) as wins
FROM public.duel_matches dm
JOIN public.player_profiles pp ON dm.winner_id = pp.id
WHERE dm.status = 'finished' AND dm.winner_id IS NOT NULL
GROUP BY dm.winner_id, pp.display_name, pp.avatar_url;

-- Grant access
GRANT SELECT ON public.duel_leaderboard TO authenticated, anon;
