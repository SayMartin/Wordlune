-- Ensure dictionary tables exist and are readable by everyone
-- This script fixes potential 'hanging' issues caused by missing RLS policies or tables

-- 1. Words Table
CREATE TABLE IF NOT EXISTS public.words (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    word_en TEXT,
    word_sv TEXT,
    word_native TEXT,
    canonical_normalized TEXT, -- legacy
    canonical_normalized_en TEXT,
    canonical_normalized_sv TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT  timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access words" ON public.words;
CREATE POLICY "Public read access words" ON public.words FOR SELECT USING (true);


-- 2. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name_native TEXT,
    name_en TEXT,
    name_sv TEXT,
    slug TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access categories" ON public.categories;
CREATE POLICY "Public read access categories" ON public.categories FOR SELECT USING (true);


-- 3. Subcategories Table
CREATE TABLE IF NOT EXISTS public.subcategories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID REFERENCES public.categories(id),
    name_native TEXT,
    name_en TEXT,
    name_sv TEXT,
    slug TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access subcategories" ON public.subcategories;
CREATE POLICY "Public read access subcategories" ON public.subcategories FOR SELECT USING (true);


-- 4. Words_Subcategories Junction Table
CREATE TABLE IF NOT EXISTS public.words_subcategories (
    word_id UUID REFERENCES public.words(id),
    subcategory_id UUID REFERENCES public.subcategories(id),
    PRIMARY KEY (word_id, subcategory_id)
);
ALTER TABLE public.words_subcategories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access words_subcategories" ON public.words_subcategories;
CREATE POLICY "Public read access words_subcategories" ON public.words_subcategories FOR SELECT USING (true);


-- Grant permissions to anonymous and authenticated users
GRANT SELECT ON public.words TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.subcategories TO anon, authenticated;
GRANT SELECT ON public.words_subcategories TO anon, authenticated;
