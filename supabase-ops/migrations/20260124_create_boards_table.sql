-- Create the boards table for game lobbies
CREATE TABLE IF NOT EXISTS public.boards (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT,
    game_id TEXT NOT NULL, -- Link to a specific game config or type
    status TEXT DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
    created_by UUID REFERENCES auth.users(id),
    visibility TEXT DEFAULT 'public', -- 'public', 'private'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent conflicts/duplication
DROP POLICY IF EXISTS "Enable read access for all users" ON public.boards;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.boards;
DROP POLICY IF EXISTS "Enable update for creators" ON public.boards;

-- Policy: Everyone can see public boards
CREATE POLICY "Enable read access for all users" ON public.boards
    FOR SELECT
    USING (visibility = 'public');

-- Policy: Authenticated users can create boards
CREATE POLICY "Enable insert for authenticated users" ON public.boards
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Policy: Creator can update their boards
CREATE POLICY "Enable update for creators" ON public.boards
    FOR UPDATE
    USING (auth.uid() = created_by);

-- Grant access to public/anon (if needed for guest users to see lobby)
GRANT SELECT ON public.boards TO anon, authenticated;
