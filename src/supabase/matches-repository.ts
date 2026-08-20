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

export async function createMatch(
  secretWord: string,
  language: string = "en",
  isHintEnabled: boolean = false,
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("User must be logged in to join a match");

  // We optimistically update status to 'playing' and setting player2_id
  const { data, error } = await supabase
    .from("duel_matches")
    .update({
      player2_id: user.id,
      status: "playing",
    })
    .eq("id", matchId)
    .is("player2_id", null) // Ensure it's not taken
    .select()
    .single();

  if (error) {
    console.error("Error joining match:", error);
    return null;
  }
  return data;
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

export async function claimVictory(matchId: string, winnerId: string) {
  const { error } = await supabase
    .from("duel_matches")
    .update({
      status: "finished",
      winner_id: winnerId,
    })
    .eq("id", matchId);

  if (error) console.error("Error checking victory:", error);
}

export interface DuelLeaderboardEntry {
  player_id: string;
  display_name: string;
  avatar_url: string;
  wins: number;
}

export async function getDuelLeaderboard(
  limit = 50,
): Promise<DuelLeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("duel_leaderboard")
    .select("*")
    .order("wins", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching duel leaderboard:", error);
    return [];
  }
  return data || [];
}
