-- Allow users to delete their own game scores
create policy "Users can delete own scores"
  on public.game_scores for delete
  using ( auth.uid() = player_id );
