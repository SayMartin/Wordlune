ALTER TABLE challenge_results ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
