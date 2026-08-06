-- Allow users to delete their own matches (e.g. while status is waiting)
-- This is required for "Cancel & Exit" functionality in Duel Lobby.

DROP POLICY IF EXISTS "Users can delete their own matches" ON duel_matches;

CREATE POLICY "Users can delete their own matches"
ON duel_matches FOR DELETE
TO authenticated
USING (
  (SELECT auth.uid()) = player1_id
);
