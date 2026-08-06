-- B: SELECT and INSERT policies (idempotent)
DROP POLICY IF EXISTS "Anyone can view matches" ON duel_matches;
CREATE POLICY "Anyone can view matches" 
ON duel_matches FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can create matches" ON duel_matches;
CREATE POLICY "Users can create matches" 
ON duel_matches FOR INSERT 
TO authenticated 
WITH CHECK ((SELECT auth.uid()) = player1_id);