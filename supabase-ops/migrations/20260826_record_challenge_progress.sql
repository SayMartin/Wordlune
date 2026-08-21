-- Makes challenge progress updates atomic.
--
-- The problem
-- -----------
-- updateChallengeProgress() in src/supabase/players-repository.ts did a
-- read-modify-write:
--
--   select total_score from challenge_attempts where id = ...   -> 10
--   update challenge_attempts set total_score = 10 + increment
--
-- Two clients finishing a word at the same moment both read 10; the first
-- writes 15, the second writes 12, and the first player's points are gone.
-- progress_index is clobbered the same way, so a challenge can jump backwards.
-- The function's own comments already noted an RPC was the right answer
-- ("Supabase/Postgrest doesn't do total_score = total_score + X easily
-- without RPC").
--
-- This is NOT a multi-device problem, though multi-device makes it easy to
-- hit: two browser tabs on one computer reach it just as well. Restricting
-- concurrent sessions would have hidden the bug rather than fixed it.
--
-- The fix
-- -------
-- One UPDATE that reads and writes in the same statement, so Postgres'
-- row-level locking serialises concurrent callers instead of letting them
-- interleave.
--
-- Two extra properties fall out of doing it here rather than in the client:
--
--   * progress_index uses greatest(), making it monotonic — progress can
--     never move backwards regardless of what order concurrent calls land in,
--     or whether a stale client sends an old index.
--   * `and player_id = auth.uid()` makes ownership part of the write itself.
--     RLS already enforces this, but a security-invoker function that states
--     it explicitly cannot be broken by a future policy change.
--
-- Deliberately NOT security definer: challenge_attempts is own-row under RLS
-- and the caller is always acting on their own attempt, so invoker rights are
-- both sufficient and safer. Contrast join_duel_match(), which must be definer
-- precisely because the joiner is not yet allowed to see the row.
create or replace function public.record_challenge_progress(
  p_attempt_id uuid,
  p_score integer,
  p_duration integer,
  p_guesses integer,
  p_new_index integer,
  p_final boolean
)
returns public.challenge_attempts
language plpgsql
security invoker
set search_path = public
as $$
declare
  a public.challenge_attempts;
begin
  update public.challenge_attempts
     set total_score    = coalesce(total_score, 0) + coalesce(p_score, 0),
         total_duration = coalesce(total_duration, 0) + coalesce(p_duration, 0),
         total_guesses  = coalesce(total_guesses, 0) + coalesce(p_guesses, 0),
         progress_index = greatest(coalesce(progress_index, 0), coalesce(p_new_index, 0)),
         status         = case when p_final then 'completed' else status end,
         completed_at   = case when p_final then now() else completed_at end
   where id = p_attempt_id
     and player_id = auth.uid()
     -- Don't reopen or double-count a challenge that's already finished or
     -- been forfeited. Without this a late-arriving request from a
     -- disconnected client could add points after the fact.
     and status = 'in_progress'
  returning * into a;

  if a.id is null then
    raise exception 'Challenge attempt not found, not yours, or no longer in progress';
  end if;

  return a;
end;
$$;

comment on function public.record_challenge_progress(uuid, integer, integer, integer, integer, boolean) is
  'Atomically adds one word''s score/duration/guesses to a challenge attempt and advances progress_index monotonically. Replaces a client-side read-modify-write that lost points when two clients (or two browser tabs) reported at the same time. Refuses attempts that are not the caller''s or not in progress.';

grant execute on function public.record_challenge_progress(uuid, integer, integer, integer, integer, boolean) to authenticated;

-- Verification, with one authenticated session:
--   select record_challenge_progress('<attempt-id>', 5, 30, 4, 1, false);
--   -- total_score rises by 5, progress_index becomes 1
--   select record_challenge_progress('<attempt-id>', 5, 30, 4, 0, false);
--   -- total_score rises by 5 again, progress_index STAYS 1 (monotonic)
--   select record_challenge_progress('<attempt-id>', 5, 30, 4, 2, true);
--   -- status becomes 'completed'
--   select record_challenge_progress('<attempt-id>', 5, 30, 4, 3, false);
--   -- raises 'no longer in progress'
