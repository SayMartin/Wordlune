import { supabase } from "../supabaseClient";

export interface Match {
  id: string;
  created_at: string;
  player1_id: string;
  player2_id: string | null;
  status: "waiting" | "playing" | "finished";
  secret_word: string;
  winner_id: string | null;
  language?: string;
  p1_name?: string;
  p2_name?: string;
  is_hint_enabled?: boolean;
  /** How the duel ended. Set by resolve_duel(); NULL on duels from before 20260828. */
  finish_reason?: "solved" | "surrender" | "disconnect" | "inactivity" | "timeout" | "both_lost" | null;
}

/**
 * An open invitation as shown in the lobby — what the `duel_lobby` view
 * exposes, which is deliberately less than a full `Match`.
 *
 * Notably there is no `secret_word` here. The lobby used to `select *` from
 * duel_matches, so any player could read the secret word of a duel they hadn't
 * joined; the view drops the column so that isn't possible even by hand-rolling
 * the request. `player2_id` is absent too — a waiting match has none.
 */
export interface LobbyMatch {
  id: string;
  created_at: string;
  player1_id: string;
  status: "waiting";
  language?: string;
  is_hint_enabled?: boolean;
  p1_name?: string;
}

/**
 * `isHintEnabled` defaults to true and the lobby no longer offers a choice.
 *
 * It was a per-match toggle, off by default, chosen by whoever created the
 * invitation — so the common duel was the hard one, and the joiner had the
 * difficulty picked for them. Fairness was never the problem: the flag lives on
 * the match, so both players got the same conditions and every duel was a fair
 * contest in itself.
 *
 * Playability was. Since 20260825 the secret is drawn from the whole language's
 * answer-eligible five-letter words — 204 in English, 180 in Swedish, 160 in
 * French — spanning animals, groceries, countries, car brands and body parts
 * with nothing to tie them together. The subcategory hint narrows that to
 * typically 10–36 candidates. Without it there is no anchor at all, and a duel
 * mostly ends with neither player finding the word.
 *
 * The parameter stays so old callers and the column keep working; nothing in
 * the app passes false any more.
 */
export async function createMatch(
  secretWord: string,
  language: string = "en",
  isHintEnabled: boolean = true,
): Promise<Match | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User must be logged in to create a match");

  const { data, error } = await supabase
    .from("duel_matches")
    .insert({
      player1_id: user.id,
      secret_word: secretWord,
      status: "waiting",
      language,
      is_hint_enabled: isHintEnabled,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating match:", error);
    return null;
  }
  return data;
}

export async function listWaitingMatches(): Promise<LobbyMatch[]> {
  // Reads the duel_lobby view rather than duel_matches directly. The view
  // already applies the "waiting, last 5 minutes" filter and joins player 1's
  // display name, so the separate cutoff computation and the follow-up
  // player_profiles lookup this function used to do are both gone — and it
  // never exposes secret_word. See 20260821_gdpr_privacy_helpers.sql.
  const { data, error } = await supabase
    .from("duel_lobby")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error listing matches:", error);
    return [];
  }

  return (data || []).map((m: any) => ({
    ...m,
    p1_name: m.p1_name || "Unknown",
  }));
}

export async function joinMatch(matchId: string): Promise<Match | null> {
  // Goes through the join_duel_match() RPC rather than updating duel_matches
  // directly (20260825_join_duel_match_rpc.sql).
  //
  // A direct update cannot work any more: SELECT on duel_matches is restricted
  // to participants, and Postgres applies that policy when *finding* the row
  // to update — evaluated against the OLD row, where the joiner is not yet a
  // participant. The update therefore matched nothing and returned success
  // with an empty body, which is a particularly unhelpful way to fail.
  //
  // The RPC also makes the claim atomic, closing a race the old version had:
  // two players pressing Join together could both pass the `is("player2_id",
  // null)` filter, and the second silently overwrote the first.
  const { data, error } = await supabase.rpc("join_duel_match", {
    p_match_id: matchId,
  });

  if (error) {
    // Expected whenever someone else got there first, the match expired, or
    // it was the caller's own invitation — not an exceptional condition.
    console.error("Error joining match:", error);
    return null;
  }
  return data as Match;
}

export async function abandonMatch(matchId: string) {
  // If player1 cancels while waiting
  const { error } = await supabase
    .from("duel_matches")
    .delete()
    .eq("id", matchId);

  if (error) {
    console.error("Error abandoning match:", error);
    throw error;
  }
}

/**
 * Finish a duel.
 *
 * `scores` is optional only because a caller might genuinely not have them
 * (a pre-start abandonment has nothing to record). Pass them whenever the
 * board was played: the final scores lived exclusively in useDuelMode's React
 * state until 20260827, which is why duel history could show who won but never
 * by how much. Columns are per side, so the caller does the mapping — it is
 * the one that knows which of player1/player2 it is.
 */
export async function claimVictory(
  matchId: string,
  winnerId: string,
  scores?: { player1_score: number; player2_score: number },
) {
  const { error } = await supabase
    .from("duel_matches")
    .update({
      status: "finished",
      winner_id: winnerId,
      finished_at: new Date().toISOString(),
      ...(scores ?? {}),
    })
    .eq("id", matchId);

  if (error) console.error("Error checking victory:", error);
}

/** Kept in step with resolve_duel()'s defaults in 20260828_duel_timeouts.sql. */
export const DUEL_INACTIVITY_SECONDS = 120;
export const DUEL_SILENCE_SECONDS = 480;

/**
 * Report the caller's own duel progress after each submitted guess.
 *
 * This is what makes a server-side verdict possible at all: guesses and
 * evaluations otherwise live only in the two clients' state and in the
 * broadcasts between them, so nothing could adjudicate a timeout. `bestCorrect`
 * / `bestPresent` are the most greens / most yellows achieved in any single
 * guess — the timeout tiebreak — and are deliberately not the score, which sums
 * every guess and therefore measures how much you have guessed rather than how
 * close you are.
 *
 * Fire-and-forget: a failed report costs a little tiebreak accuracy, never the
 * round, so it must not interrupt play.
 */
export async function recordDuelProgress(
  matchId: string,
  progress: { guesses: number; bestCorrect: number; bestPresent: number; score: number },
): Promise<void> {
  const { error } = await supabase.rpc("record_duel_progress", {
    p_match_id: matchId,
    p_guesses: progress.guesses,
    p_best_correct: progress.bestCorrect,
    p_best_present: progress.bestPresent,
    p_score: progress.score,
  });
  if (error) console.error("Error recording duel progress:", error);
}

/**
 * Ask the server whether either duel clock has run out, and let it decide.
 *
 * Returns the match unchanged when neither has. Both clients may call this at
 * the same moment — the row is locked and the function is a no-op once the duel
 * is finished, so they cannot reach different answers. The pg_cron sweeper
 * calls the same function for matches both players have abandoned.
 */
export async function resolveDuel(matchId: string): Promise<Match | null> {
  const { data, error } = await supabase.rpc("resolve_duel", { p_match_id: matchId });
  if (error) {
    console.error("Error resolving duel:", error);
    return null;
  }
  return (data as Match) ?? null;
}

export interface DuelLeaderboardEntry {
  player_id: string;
  display_name: string;
  avatar_url: string | null;
  wins: number;
  /** Added 20260827 — the old view joined on winner_id, so losers never appeared. */
  losses: number;
  played: number;
  /** wins − losses. The ranking value; can be negative. */
  diff: number;
}

/**
 * Ranked by diff, not by wins.
 *
 * Wins alone rank whoever has played the most — a 20–15 record would sit above
 * a 9–0 one, which says the opposite of what a leaderboard is for. Ties on diff
 * break on wins, so at the same difference the longer record places higher.
 */
export async function getDuelLeaderboard(
  limit = 50,
): Promise<DuelLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("duel_leaderboard")
    .select("*")
    .order("diff", { ascending: false })
    .order("wins", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching duel leaderboard:", error);
    return [];
  }
  return data || [];
}

export interface DuelHistoryEntry {
  id: string;
  created_at: string;
  finished_at: string | null;
  language: string | null;
  opponent_id: string | null;
  opponent_name: string | null;
  /** NULL for duels finished before scores were persisted (20260827). */
  my_score: number | null;
  opponent_score: number | null;
  won: boolean;
}

/**
 * The player's own finished duels.
 *
 * Reads `my_duel_history`, a security-definer view filtered on `auth.uid()` —
 * the opponent's display name is in `player_profiles`, which is own-row locked,
 * so there is no invoker-rights way to get a name instead of a blank.
 */
export async function getMyDuelHistory(
  limit = 50,
): Promise<DuelHistoryEntry[]> {
  const { data, error } = await supabase
    .from("my_duel_history")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching duel history:", error);
    return [];
  }
  return data || [];
}
