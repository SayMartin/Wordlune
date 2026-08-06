-- 1. Ensure no nulls exist (fill with truncated uuid if needed)
-- defaulting to 'user_' + first 8 chars of UUID for existing nulls
UPDATE player_profiles 
SET display_name = 'user_' || substr(id::text, 1, 8) 
WHERE display_name IS NULL;

-- 2. Handle existing duplicates before enforcing unique constraint
-- This appends a number to duplicate names (e.g., King, King_1, King_2)
DO $$
DECLARE
    r RECORD;
    i INT;
    new_name TEXT;
BEGIN
    FOR r IN SELECT display_name, count(*) FROM player_profiles GROUP BY display_name HAVING count(*) > 1 LOOP
        i := 1;
        -- Loop through duplicates of this specific name, skipping the first one (keeping it as is)
        FOR new_name IN SELECT id FROM player_profiles WHERE display_name = r.display_name ORDER BY created_at OFFSET 1 LOOP
             UPDATE player_profiles SET display_name = r.display_name || i WHERE id = new_name::uuid;
             i := i + 1;
        END LOOP;
    END LOOP;
END$$;

-- 3. Apply constraints
ALTER TABLE player_profiles 
  ALTER COLUMN display_name SET NOT NULL,
  ADD CONSTRAINT player_profiles_display_name_unique UNIQUE (display_name);
