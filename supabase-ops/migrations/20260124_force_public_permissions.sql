-- 1. Enable RLS on all related tables (best practice)
ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.words_categories ENABLE ROW LEVEL SECURITY;

-- 2. Drop any existing restrictive policies to start fresh
DROP POLICY IF EXISTS "Public read access words" ON public.words;
DROP POLICY IF EXISTS "Public read access categories" ON public.categories;
DROP POLICY IF EXISTS "Public read access subcategories" ON public.subcategories;
DROP POLICY IF EXISTS "Public read access words_subcategories" ON public.words_subcategories;
DROP POLICY IF EXISTS "Public read access words_categories" ON public.words_categories;

-- 3. Create permissive policies for EVERYONE (True for everyone)
CREATE POLICY "Public read access words" ON public.words FOR SELECT USING (true);
CREATE POLICY "Public read access categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Public read access subcategories" ON public.subcategories FOR SELECT USING (true);
CREATE POLICY "Public read access words_subcategories" ON public.words_subcategories FOR SELECT USING (true);
CREATE POLICY "Public read access words_categories" ON public.words_categories FOR SELECT USING (true);

-- 4. Grant explicit SELECT permissions to the role used by the App
GRANT SELECT ON public.words TO anon, authenticated;
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT SELECT ON public.subcategories TO anon, authenticated;
GRANT SELECT ON public.words_subcategories TO anon, authenticated;
GRANT SELECT ON public.words_categories TO anon, authenticated;
