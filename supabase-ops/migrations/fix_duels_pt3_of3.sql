-- C: Consolidated UPDATE policy (idempotent)
DROP POLICY IF EXISTS "Players can update their match" ON duel_matches;

CREATE POLICY "Players can update their match"
ON duel_matches FOR UPDATE
TO authenticated
USING (
  (SELECT auth.uid()) = player1_id
  OR (SELECT auth.uid()) = player2_id
  OR player2_id IS NULL
)
WITH CHECK (
  -- If you're player1, allow updates (you may want to restrict fields separately)
  ((SELECT auth.uid()) = player1_id)
  OR
  -- If you're already player2, allow updates
  ((SELECT auth.uid()) = player2_id)
  OR
  -- If joining: NEW.player2_id must be your id (this expression runs on NEW row)
  (player2_id = (SELECT auth.uid()))
);