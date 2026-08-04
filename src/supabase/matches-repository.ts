import { supabase } from "../supabaseClient";

export interface Match {
  id: string;
  created_at: string;
  player1_id: string;
  player2_id: string | null;
  status: "waiting" | "playing" | "finished";
  secret_word: string;
  winner_id: string | null;
  player1_email?: string; // Loaded via join if needed, or separate profile fetch
  language?: string;
  p1_name?: string;
  p2_name?: string;
  is_hint_enabled?: boolean;
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

export async function listWaitingMatches(): Promise<Match[]> {
  // Only show matches from the last 5 minutes
  const cutOffTime = new Date();
  cutOffTime.setMinutes(cutOffTime.getMinutes() - 5);

  const { data, error } = await supabase
    .from("duel_matches")
    .select("*")
    .eq("status", "waiting")
    .gt("created_at", cutOffTime.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error listing matches:", error);
    return [];
  }

  // Enrich with Player1 display name
  const p1Ids = data.map((m: any) => m.player1_id);
  // Also collect player2 ids if any
  const p2Ids = data.map((m: any) => m.player2_id).filter((id: any) => !!id);
  const allIds = Array.from(new Set([...p1Ids, ...p2Ids]));

  if (allIds.length === 0) return data;

  const { data: profiles } = await supabase
    .from("player_profiles")
    .select("id, display_name")
    .in("id", allIds);

  const nameMap: Record<string, string> = {};
  profiles?.forEach((p: any) => {
    nameMap[p.id] = p.display_name;
  });

  return data.map((m: any) => ({
    ...m,
    p1_name: nameMap[m.player1_id] || "Unknown",
    p2_name: m.player2_id ? nameMap[m.player2_id] : undefined,
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
