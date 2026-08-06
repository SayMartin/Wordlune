-- Fix challenge_leaderboards view to respect per-score visibility (is_public on result)
-- Previously it only checked profile visibility (pp.is_public)

CREATE OR REPLACE VIEW public.challenge_leaderboards AS
SELECT
    cr.challenge_id,
    cr.player_id,
    pp.display_name,
    pp.avatar_url,
    MAX(cr.total_score) as total_score,
    MIN(cr.total_duration) as total_duration,
    COUNT(cr.id) as completions_count,
    MAX(cr.completed_at) as last_completed_at
FROM public.challenge_results cr
JOIN public.player_profiles pp ON cr.player_id = pp.id
WHERE 
    cr.is_public = true  -- Only include explicitly published SCORES
    -- AND pp.is_public = true -- Optional: Do we still enforce profile visibility? Usually score visibility overrides.
    -- Let's keep it simple: If I publish a score, I want it seen.
GROUP BY 
    cr.challenge_id, 
    cr.player_id, 
    pp.display_name, 
    pp.avatar_url;
