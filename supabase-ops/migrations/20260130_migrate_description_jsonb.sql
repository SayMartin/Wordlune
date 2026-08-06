-- Change description column provided from text to jsonb
-- structure will change from stringified json to actual jsonb
-- ideally we want lists to be arrays strings, not comma-separated strings
-- This migration just changes the type. Data cleanup might be needed if format changes.

-- 1. Drop the view dependent on the column
DROP VIEW IF EXISTS public.challenge_menu_stats;

-- 2. Alter the table
ALTER TABLE public.competitive_challenges 
ALTER COLUMN description TYPE JSONB 
USING description::jsonb;

-- 3. Recreate the view (same definition, but now description is jsonb)
CREATE VIEW public.challenge_menu_stats AS
SELECT 
    c.id, 
    c.name, 
    c.description, -- Now jsonb
    c.difficulty, 
    c.subcategory_ids, 
    COUNT(ca.id) FILTER (WHERE ca.status = 'completed') as completions_count
FROM public.competitive_challenges c
LEFT JOIN public.challenge_attempts ca ON c.id = ca.challenge_id
GROUP BY c.id, c.name, c.description, c.difficulty, c.subcategory_ids;
