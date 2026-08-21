-- Makes joining a duel work again after the RLS lockdown, without reopening
-- the hole the lockdown closed.
--
-- The problem
-- -----------
-- 20260824 locked duel_matches SELECT to participants:
--   using (auth.uid() = player1_id or auth.uid() = player2_id)
--
-- joinMatch() was a plain `update duel_matches set player2_id = me ...
-- .select().single()`. That now returns 200 with an empty body, silently.
--
-- The reason is a step earlier than the one 20260822's comment assumed.
-- PostgreSQL applies SELECT policies to an UPDATE when the statement needs to
-- *find* the row (a WHERE clause) or return it (RETURNING) — and that check
-- runs against the OLD row. On the old row the joiner is neither player1_id
-- nor player2_id (it's still NULL), so the row is invisible, the UPDATE
-- matches nothing, and no error is raised. Verified against production.
--
-- Widening the SELECT policy to cover open invitations would fix the join and
-- undo the point of the lockdown: `secret_word` would again be readable by
-- anyone before joining, which is a straightforward cheat, not just a privacy
-- issue. So joining becomes an explicit guarded operation instead.
--
-- Bonus: this also closes a race the client-side version had. Two players
-- hitting Join at the same moment could both read status='waiting' and both
-- issue the update; the second silently overwrote the first. The
-- `and player2_id is null` predicate inside the UPDATE makes the claim atomic
-- — exactly one caller wins, the other gets a clean error.
create or replace function public.join_duel_match(p_match_id uuid)
returns public.duel_matches
language plpgsql
security definer
set search_path = public
as $$
declare
  m public.duel_matches;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.duel_matches
     set player2_id = auth.uid(),
         status = 'playing'
   where id = p_match_id
     and status = 'waiting'
     and player2_id is null
     -- Can't duel yourself; without this a player could join their own
     -- invitation and see both boards.
     and player1_id <> auth.uid()
     -- Mirrors the 5-minute window duel_lobby advertises, with slack for a
     -- player who took a moment to click. An abandoned invitation shouldn't
     -- stay joinable forever.
     and created_at > now() - interval '15 minutes'
  returning * into m;

  if m.id is null then
    raise exception 'Match is no longer available';
  end if;

  return m;
end;
$$;

comment on function public.join_duel_match(uuid) is
  'Atomically claims an open duel invitation for the calling player and returns the full match row (including secret_word, which the joiner now legitimately needs). Security definer because duel_matches SELECT is restricted to participants, and before joining the caller is not one. Refuses matches that are already taken, self-created, or older than 15 minutes.';

grant execute on function public.join_duel_match(uuid) to authenticated;

-- Verification (two guest sessions A and B):
--   A: insert a duel_matches row
--   B: select join_duel_match('<id>')  -> full row, secret_word present
--   B: repeat                          -> 'Match is no longer available'
--   A: select join_duel_match on own   -> 'Match is no longer available'
