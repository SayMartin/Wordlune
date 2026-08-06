-- Allow users to update their own challenge results (e.g. for is_public visibility)
CREATE POLICY "Users can update own challenge results"
  ON public.challenge_results FOR UPDATE
  USING ( auth.uid() = player_id );

-- Allow users to delete their own challenge results
CREATE POLICY "Users can delete own challenge results"
  ON public.challenge_results FOR DELETE
  USING ( auth.uid() = player_id );
