ALTER TABLE public.competitive_challenges
ADD COLUMN IF NOT EXISTS is_five_chars BOOLEAN DEFAULT FALSE;
