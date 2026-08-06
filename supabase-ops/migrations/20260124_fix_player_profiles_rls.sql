-- Ensure player_profiles policies are correct for both Anon and Authenticated users
-- (Note: Anonymous users in Supabase usually have the 'authenticated' role but with is_anonymous=true claim,
--  however, safe to cover our bases).

-- 1. Enable RLS
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

-- 2. Allow users to insert their *own* profile (needed for the trigger? 
--    Actually the trigger runs with security definer so it bypasses RLS for insertion usually, 
--    but let's ensure insert is allowed if client does it directly).
--    Re-reading: the trigger handles insertion. So we mainly need SELECT/UPDATE.

-- 3. Allow users to Read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON public.player_profiles;
CREATE POLICY "Users can read own profile" ON public.player_profiles
    FOR SELECT
    USING (auth.uid() = id);

-- 4. Allow users to Update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON public.player_profiles;
CREATE POLICY "Users can update own profile" ON public.player_profiles
    FOR UPDATE
    USING (auth.uid() = id);

-- 5. Allow ALL users (including Anon) to read OTHER users' profiles (e.g. for Leaderboards or 'Playing as X' if public)?
--    For now, let's stick to "Users can read own profile".
--    If we want leaderboards, we might need a separate policy like "Anyone can read display_name/avatar of anyone".

DROP POLICY IF EXISTS "Public read access for leaderboard" ON public.player_profiles;
CREATE POLICY "Public read access for leaderboard" ON public.player_profiles
    FOR SELECT
    USING (true); 
    -- Make profiles public read-only (display_name, avatar, level).
    -- If we have sensitive data (email is not in this table), filter columns or use strict policy.
    -- player_profiles only has: id, display_name, avatar_url, metadata. This is generally public info in a game.

-- Grant access
GRANT SELECT, UPDATE, INSERT ON public.player_profiles TO anon, authenticated;

-- Ensure player_settings table exists and has RLS
CREATE TABLE IF NOT EXISTS public.player_settings (
    player_id UUID PRIMARY KEY REFERENCES public.player_profiles(id),
    theme TEXT DEFAULT 'system',
    language TEXT DEFAULT 'en',
    volume INTEGER DEFAULT 100,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.player_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own settings" ON public.player_settings;
CREATE POLICY "Users can read own settings" ON public.player_settings
    FOR SELECT
    USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.player_settings;
CREATE POLICY "Users can update own settings" ON public.player_settings
    FOR UPDATE
    USING (auth.uid() = player_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.player_settings;
CREATE POLICY "Users can insert own settings" ON public.player_settings
    FOR INSERT
    WITH CHECK (auth.uid() = player_id);

GRANT SELECT, INSERT, UPDATE ON public.player_settings TO anon, authenticated;
