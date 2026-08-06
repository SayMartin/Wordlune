-- Drop the view first to allow changing column structure (inserting description)
DROP VIEW IF EXISTS public.challenge_menu_stats;

-- Recreate the view with the description column
CREATE VIEW public.challenge_menu_stats AS
SELECT 
    c.id, 
    c.name, 
    c.description, 
    c.difficulty, 
    c.subcategory_ids, -- Array of UUIDs
    COUNT(ca.id) FILTER (WHERE ca.status = 'completed') as completions_count
FROM public.competitive_challenges c
LEFT JOIN public.challenge_attempts ca ON c.id = ca.challenge_id
GROUP BY c.id, c.name, c.description, c.difficulty, c.subcategory_ids;
