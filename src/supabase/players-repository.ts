import { supabase } from "../supabaseClient";
import { wordColumn } from "./langColumns";
import { localAvatarUrl } from "../components/Avatar";

export const MAX_DISPLAY_NAME_LENGTH = 15;

// --- Types ---

export interface PlayerProfile {
  id: string; // The player's UUID (references auth.users)
  display_name?: string;
  avatar_url?: string;
  is_public?: boolean; // Controls visibility on leaderboards
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

export interface PlayerSettings {
  player_id: string;
  theme?: "light" | "dark" | "system";
  language?: string; // e.g., 'en', 'sv'
  reduceMotion?: boolean;
  volume?: number; // 0-100
  updated_at?: string;
}

export interface GameScore {
  id?: string;
  player_id: string;
  score: number;
  word?: string;
  max_letters?: number;
  guesses_count?: number;
  is_always_five_letters?: boolean;
  game_mode?: "practice" | "competitive" | "duel";
  seed?: string;
  language?: string;
  is_public?: boolean;
  duration_seconds?: number;
  challenge_id?: string;
  completed_at?: string; // defaults to now() in DB
  competitive_challenges?: { name: string } | null; // Joined field
}

export interface LeaderboardEntry {
  player_id: string;
  display_name: string;
  avatar_url: string | null;
  score: number;
  completed_at: string;
  challenge_name?: string;
}

// --- Profile Management ---

/**
 * Check if a specific display name is already taken.
 */
export async function isDisplayNameTaken(name: string): Promise<boolean> {
  // If the name is empty, consider it "invalid" or handle as true/false based on need.
  // Generally checks "is this specific non-empty string taken?"
  if (!name) return false;

  // Goes through the display_name_available() RPC rather than reading
  // player_profiles directly: the base table is locked to own-row-only
  // (20260822_gdpr_rls_lockdown.sql), so a direct query would always report
  // "free" regardless of the truth. See 20260821_gdpr_privacy_helpers.sql.
  const { data, error } = await supabase.rpc("display_name_available", {
    p_name: name,
  });

  if (error) {
    console.error("Error checking display name availability:", error);
    // Fail safe: assume taken if error to prevent collision, or throw.
    return true;
  }
  return data === false;
}

/**
 * Propose a unique display name based on a desired name.
 * e.g. "King" -> "King1" if King is taken.
 */
export async function suggestUniqueDisplayName(
  baseName: string,
): Promise<string> {
  // 0. Sanitize input length immediately
  if (baseName.length > MAX_DISPLAY_NAME_LENGTH) {
    baseName = baseName.slice(0, MAX_DISPLAY_NAME_LENGTH);
  }

  // The suffix search runs server-side (suggest_display_name(), see
  // 20260821_gdpr_privacy_helpers.sql). It used to be a client-side
  // `ilike '<prefix>%'` over player_profiles, which handed every matching
  // display name in the table to the caller just to pick a free number.
  const { data, error } = await supabase.rpc("suggest_display_name", {
    p_base: baseName,
  });

  if (error || typeof data !== "string") {
    console.error("Error suggesting a display name:", error);
    // Fallback: strict truncation and random number
    const suffix = Math.floor(Math.random() * 999).toString();
    const maxBase = MAX_DISPLAY_NAME_LENGTH - suffix.length;
    return `${baseName.slice(0, maxBase)}${suffix}`;
  }

  return data;
}

/**
 * Fetch the profile for the specified player.
 *
 * Retries a few times on "no rows" (PGRST116): right after signup/anonymous
 * sign-in, the DB trigger that creates the player_profiles row can still be
 * in flight, so the very first read can legitimately find nothing yet.
 */
export async function getPlayerProfile(
  playerId: string,
  retriesLeft = 3,
): Promise<PlayerProfile | null> {
  // Mapping 'id' from the table to our logical 'playerId' if needed, but here it is just the PK
  const { data, error } = await supabase
    .from("player_profiles")
    .select("*")
    .eq("id", playerId)
    .single();

  if (error && error.code === "PGRST116" && retriesLeft > 0) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    return getPlayerProfile(playerId, retriesLeft - 1);
  }

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching player profile:", error);
    return null;
  }

  return data;
}

/**
 * Fetch the profile for the specified player, creating one client-side if
 * it's genuinely missing (not just still-being-created by the on_auth_user_created
 * trigger, which getPlayerProfile's retries already cover). This heals sessions
 * left behind by earlier signups where the trigger's insert failed — e.g. an
 * anonymous sign-in with no display_name violating the NOT NULL/unique
 * constraint on player_profiles.display_name — so the auth session exists but
 * its profile row never does.
 */
export async function ensurePlayerProfile(
  userId: string,
  opts?: { displayName?: string; avatarUrl?: string },
): Promise<PlayerProfile | null> {
  const existing = await getPlayerProfile(userId, 0);
  if (existing) return existing;

  const displayName = opts?.displayName || (await suggestUniqueDisplayName("Guest"));
  const avatarUrl =
    opts?.avatarUrl ||
    localAvatarUrl(displayName);

  const { data, error } = await supabase
    .from("player_profiles")
    .upsert(
      { id: userId, display_name: displayName, avatar_url: avatarUrl },
      { onConflict: "id" },
    )
    .select()
    .single();

  if (error) {
    console.error("Error creating fallback player profile:", error);
    return null;
  }
  return data;
}

/**
 * Update (or insert) the player's profile information.
 */
export async function updatePlayerProfile(
  playerId: string,
  updates: Partial<PlayerProfile>,
): Promise<PlayerProfile | null> {
  const { data, error } = await supabase
    .from("player_profiles")
    .upsert({ id: playerId, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();

  if (error) {
    console.error("Error updating player profile:", error);
    return null;
  }
  return data;
}

/**
 * Permanently delete the calling user's own account (guest or registered)
 * and everything tied to it. Runs as the `delete_own_account` Postgres
 * function (supabase-ops/migrations/20260818_delete_own_account.sql), which
 * deletes the auth.users row for auth.uid() — a regular client can't do
 * this directly (requires the service-role key), so it goes through a
 * security-definer RPC instead. Deleting auth.users cascades into
 * player_profiles -> game_scores/challenge_attempts/challenge_results, and
 * duel_matches.
 */
export async function deleteOwnAccount(): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    console.error("Error deleting account:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

// --- Settings Management ---

/**
 * Fetch settings for a player from their profile metadata.
 */
export async function getPlayerSettings(
  playerId: string,
): Promise<PlayerSettings | null> {
  const profile = await getPlayerProfile(playerId);
  if (!profile) return null;

  const settings = profile.metadata?.settings || {};
  return {
    player_id: playerId,
    ...settings,
  };
}

/**
 * Update player settings in their profile metadata.
 */
export async function updatePlayerSettings(
  playerId: string,
  settingsUpdates: Partial<Exclude<PlayerSettings, "player_id">>,
): Promise<PlayerSettings | null> {
  const profile = await getPlayerProfile(playerId);
  if (!profile) return null;

  const currentSettings = profile.metadata?.settings || {};
  const newSettings = { ...currentSettings, ...settingsUpdates };

  const { data, error } = await supabase
    .from("player_profiles")
    .update({
      metadata: {
        ...profile.metadata,
        settings: newSettings,
      },
      updated_at: new Date().toISOString(),
    })
    .eq("id", playerId)
    .select()
    .single();

  if (error) {
    console.error("Error updating player settings:", error);
    return null;
  }

  return {
    player_id: playerId,
    ...(data.metadata?.settings || {}),
  };
}

/**
 * Merge top-level keys into player_profiles.metadata, leaving everything else
 * (including `settings` and `level`) untouched.
 *
 * Same read-modify-write shape as updatePlayerSettings above, one level up:
 * that one merges into metadata.settings, this one merges into metadata
 * itself. Used for the privacy-policy acceptance stamp.
 */
export async function updatePlayerProfileMetadata(
  playerId: string,
  metadataUpdates: Record<string, any>,
): Promise<boolean> {
  const profile = await getPlayerProfile(playerId);
  if (!profile) return false;

  const { error } = await supabase
    .from("player_profiles")
    .update({
      metadata: { ...profile.metadata, ...metadataUpdates },
      updated_at: new Date().toISOString(),
    })
    .eq("id", playerId);

  if (error) {
    console.error("Error updating player profile metadata:", error);
    return false;
  }
  return true;
}

/**
 * Everything this app holds about the calling player, as one plain object —
 * the GDPR Art. 15 (access) and Art. 20 (portability) request, self-served.
 *
 * All six queries work under the own-row RLS policies from
 * 20260822_gdpr_rls_lockdown.sql; none of them can return another player's
 * rows even if the filters were wrong. `duel_matches` is the one exception to
 * "filter by player_id" — a duel belongs to two people, so it matches on
 * either side, and the opponent's id is part of what happened to you.
 *
 * Device-side data (the wordlune:* AsyncStorage keys) is added by the caller,
 * since a repository has no business reading local storage.
 */
export async function exportMyData(): Promise<Record<string, any> | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const id = user.id;

  const [profile, scores, attempts, results, duels] = await Promise.all([
    supabase.from("player_profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("game_scores").select("*").eq("player_id", id),
    supabase.from("challenge_attempts").select("*").eq("player_id", id),
    supabase
      .from("challenge_results")
      .select("*, competitive_challenges(name)")
      .eq("player_id", id),
    supabase
      .from("duel_matches")
      .select("*")
      .or(`player1_id.eq.${id},player2_id.eq.${id}`),
  ]);

  return {
    format_version: 1,
    exported_at: new Date().toISOString(),
    app: "Wordlune",
    // Only the auth.users fields a client may legitimately read about itself.
    // Never the password hash — it isn't exposed to the client at all, and
    // wouldn't be useful or safe to hand over if it were.
    account: {
      id: user.id,
      email: user.email ?? null,
      is_anonymous: user.is_anonymous ?? false,
      created_at: user.created_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
      user_metadata: user.user_metadata ?? {},
    },
    profile: profile.data ?? null,
    game_scores: scores.data ?? [],
    challenge_attempts: attempts.data ?? [],
    challenge_results: results.data ?? [],
    duel_matches: duels.data ?? [],
  };
}

// --- Score & Game History ---

/**
 * Record a new game score.
 */
export async function saveGameScore(
  scoreData: PlayerGameScoreInsert,
): Promise<{ data: GameScore | null; error: any | null }> {
  // Ensure language is 2 chars
  if (scoreData.language && scoreData.language.includes("-")) {
    scoreData.language = scoreData.language.split("-")[0];
  }

  const { data, error } = await supabase
    .from("game_scores")
    .insert([scoreData]) // scoreData should have player_id
    .select()
    .single();

  if (error) {
    console.error("Error saving game score:", error);
    return { data: null, error };
  }
  return { data, error: null };
}

type PlayerGameScoreInsert = Omit<GameScore, "id" | "completed_at">;

export interface ChallengeResult {
  id: string;
  player_id: string;
  challenge_id: string;
  total_score: number;
  total_duration: number;
  total_guesses: number;
  completed_at: string;
  is_public?: boolean;
}

export type ChallengeResultInsert = Omit<
  ChallengeResult,
  "id" | "completed_at"
>;

export async function saveChallengeResult(
  resultData: ChallengeResultInsert,
): Promise<{ data: ChallengeResult | null; error: any }> {
  const { data, error } = await supabase
    .from("challenge_results")
    .insert([resultData])
    .select()
    .single();

  if (error) {
    console.error("Error saving challenge result:", error);
    return { data: null, error };
  }
  return { data, error: null };
}

export async function getMyChallengeResults(
  playerId: string,
): Promise<ChallengeResult[]> {
  const { data, error } = await supabase
    .from("challenge_results")
    .select(
      `
            *,
            competitive_challenges (
                name
            )
        `,
    )
    .eq("player_id", playerId)
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("Error fetching my challenge results:", error);
    return [];
  }
  return data as any; // Using any to bypass strict type check on the joined property for now
}

export async function updateChallengeResultVisibility(
  resultId: string,
  isPublic: boolean,
): Promise<{ success: boolean; error: any }> {
  const { error } = await supabase
    .from("challenge_results")
    .update({ is_public: isPublic })
    .eq("id", resultId);

  return { success: !error, error };
}

export async function deleteChallengeResult(
  resultId: string,
): Promise<{ success: boolean; error: any }> {
  const { error } = await supabase
    .from("challenge_results")
    .delete()
    .eq("id", resultId);

  return { success: !error, error };
}

// --- Competitive Challenges & Attempts ---

export interface ChallengeMetadata {
  id: string;
  name: string;
  description?: any; // JSONB can be anything, typically { en: string[], sv: string[] }
  difficulty: string;
  subcategory_ids: string[];
  completions_count: number;
  is_five_chars?: boolean;
}

export interface ChallengeAttempt {
  id: string;
  player_id: string;
  challenge_id: string;
  started_at: string;
  completed_at?: string;
  status: "in_progress" | "completed" | "forfeited";
  progress_index: number;
  total_score: number;
  total_duration: number;
  total_guesses: number;
}

/**
 * Fetch list of challenges for the "Select a Challenge" menu.
 * Returns metadata: name, difficulty, completion count.
 * Excludes challenges the player has already attempted (based on backend logic or we can filter in client).
 * For now, this view returns all challenges with global stats.
 */
export async function getChallengeMenu(): Promise<ChallengeMetadata[]> {
  const { data, error } = await supabase
    .from("challenge_menu_stats")
    .select("*")
    .order("name", { ascending: true }); // or by date

  if (error) {
    console.error("Error fetching challenge menu:", error);
    return [];
  }
  return data || [];
}

/**
 * Check if the current player has an existing attempt for this challenge.
 * Used to lock/unlock the challenge card or "Resume".
 */
export async function getMyChallengeAttempt(
  playerId: string,
  challengeId: string,
): Promise<ChallengeAttempt | null> {
  const { data, error } = await supabase
    .from("challenge_attempts")
    .select("*")
    .eq("player_id", playerId)
    .eq("challenge_id", challengeId)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error checking challenge attempt:", error);
  }
  return data || null;
}

/**
 * Fetch all challenge attempts for a player.
 */
export async function getMyChallengeAttempts(
  playerId: string,
): Promise<ChallengeAttempt[]> {
  const { data, error } = await supabase
    .from("challenge_attempts")
    .select("*")
    .eq("player_id", playerId);

  if (error) {
    console.error("Error fetching challenge attempts:", error);
    return [];
  }
  return data || [];
}

/**
 * Start a challenge.
 * Creates an 'in_progress' attempt. Fails if one already exists (DB unique constraint).
 */
export async function startChallenge(
  playerId: string,
  challengeId: string,
): Promise<{ attempt: ChallengeAttempt | null; error: any }> {
  // First, verify we don't have one
  const existing = await getMyChallengeAttempt(playerId, challengeId);
  if (existing) {
    if (existing.status !== "in_progress") {
      return {
        attempt: existing,
        error: "Challenge already completed/forfeited",
      };
    }
    // If in_progress, just return it (Resume logic)
    return { attempt: existing, error: null };
  }

  const { data, error } = await supabase
    .from("challenge_attempts")
    .insert([
      {
        player_id: playerId,
        challenge_id: challengeId,
        status: "in_progress",
        progress_index: 0,
        total_score: 0,
        total_guesses: 0,
      },
    ])
    .select()
    .single();

  if (error) return { attempt: null, error };
  return { attempt: data, error: null };
}

/**
 * Mark a challenge as forfeited (e.g. user quit).
 */
export async function forfeitChallenge(
  attemptId: string,
): Promise<{ success: boolean; error: any }> {
  const { error } = await supabase
    .from("challenge_attempts")
    .update({ status: "forfeited", completed_at: new Date().toISOString() })
    .eq("id", attemptId);

  if (error) return { success: false, error };
  return { success: true, error: null };
}

/**
 * Update progress (increment index, add score).
 * If index reaches 5 (or max), mark as completed.
 */
export async function updateChallengeProgress(
  attemptId: string,
  incrementScore: number,
  incrementDuration: number,
  incrementGuesses: number,
  newIndex: number, // e.g. going from 0 -> 1
  isFinal: boolean, // if true, mark status=completed
): Promise<{ success: boolean; error: any }> {
  // We need to fetch current totals first to increment safely?
  // Or we can rely on caller passing correct cumulative, but an atomic increment is better.
  // Supabase/Postgrest doesn't do "total_score = total_score + X" easily without RPC.
  // For simplicity, we'll fetch then update, or trust the caller to pass the NEW TOTAL.
  // Let's assume the caller tracks the session total state.
  // actually, safer to just use RPC if possible, but let's stick to simple update for now.

  const updates: any = {
    progress_index: newIndex,
    // Note: This replaces the value. Caller must provide the CUMULATIVE total.
    // If we want delta updates, we need an RPC.
    // For now, let's assume the client sends the *delta* and we do a fetch-update here?
    // No, client state might be lost.
    // Let's do a quick read-modify-write.
  };

  if (isFinal) {
    updates.status = "completed";
    updates.completed_at = new Date().toISOString();
  }

  // Read current to increment
  const { data: current, error: readError } = await supabase
    .from("challenge_attempts")
    .select("total_score, total_duration, total_guesses")
    .eq("id", attemptId)
    .single();

  if (readError) return { success: false, error: readError };

  updates.total_score = (current.total_score || 0) + incrementScore;
  updates.total_duration = (current.total_duration || 0) + incrementDuration;
  updates.total_guesses = (current.total_guesses || 0) + incrementGuesses;

  const { error } = await supabase
    .from("challenge_attempts")
    .update(updates)
    .eq("id", attemptId);

  return { success: !error, error };
}

/**
 * Bulk update visibility for a list of game scores.
 * @param updates Array of objects with score ID and new is_public status.
 */
export async function updateGameScoresVisibility(
  updates: { id: string; is_public: boolean }[],
): Promise<{ success: boolean; error: any }> {
  try {
    // Supabase doesn't support bulk update with different values easily in one query
    // via standard SDK unless we upsert, but upsert requires all required fields.
    // Iterating is easiest for a small list or we can use an RPC if performance critical.
    // Given the likely volume (user clicking save on a page of 20 items), Promise.all is fine.

    await Promise.all(
      updates.map((u) =>
        supabase
          .from("game_scores")
          .update({ is_public: u.is_public })
          .eq("id", u.id),
      ),
    );

    return { success: true, error: null };
  } catch (err) {
    console.error("Error bulk updating visibility:", err);
    return { success: false, error: err };
  }
}

/**
 * Delete a list of game scores.
 */
export async function deleteGameScores(
  ids: string[],
): Promise<{ success: boolean; error: any }> {
  const { error } = await supabase.from("game_scores").delete().in("id", ids);

  if (error) {
    console.error("Error deleting game scores:", error);
    return { success: false, error };
  }
  return { success: true, error: null };
}

/**
 * Get the playing history for the current player.
 * Now reads from the unified VIEW.
 */
export async function getPlayerGameHistory(
  playerId: string,
  limit = 20,
): Promise<any[]> {
  // Using 'any' briefly or define a Union Type
  const { data, error } = await supabase
    .from("player_history_view") // Changed from game_scores to View
    .select("*")
    .eq("player_id", playerId)
    .order("completed_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching player game history:", error);
    return [];
  }
  return data || [];
}

type ScoreFilter = {
  mode?: "practice" | "competitive";
};

/**
 * Get top scores from all players (Leaderboard).
 */
export async function getGlobalLeaderboard(
  limit = 20,
  filter?: ScoreFilter,
): Promise<LeaderboardEntry[]> {
  // Use the view 'leaderboard_entries' which handles is_public and game_mode logic
  // (Only shows public competitive scores)
  // Logic: score.is_public = true AND score.game_mode = 'competitive'

  let query = supabase.from("leaderboard_entries").select("*");

  // View is already filtered for competitive, but if the caller asks for practice,
  // we should return nothing (or respect the filter, which will return 0 rows from view)
  // The view is hardcoded to 'competitive', so effectively this is always competitive.
  if (filter?.mode && filter.mode !== "competitive") {
    return [];
  }

  const { data, error } = await query
    .order("score", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching leaderboard:", error);
    // Fallback to manual query if view doesn't exist?
    // No, better to fail or return empty than show private data.
    return [];
  }

  // View returns flat structure
  return (data || []).map((entry: any) => ({
    player_id: entry.player_id,
    score: entry.score,
    completed_at: entry.completed_at,
    display_name: entry.display_name || "Unknown",
    avatar_url: entry.avatar_url || null,
    challenge_name: entry.challenge_name,
  }));
}

export async function getMyScores(
  playerId: string,
  filter?: ScoreFilter,
): Promise<GameScore[]> {
  let query = supabase
    .from("game_scores")
    .select("*, competitive_challenges(name)")
    .eq("player_id", playerId)
    .order("completed_at", { ascending: false });

  if (filter?.mode) {
    query = query.eq("game_mode", filter.mode);
  }

  const { data, error } = await query.limit(50);
  if (error) return [];
  return data || [];
}

/**
 * Retrieve the actual word strings for a challenge, in order, matching the requested language.
 */
export async function getChallengeWords(
  challengeId: string,
  lang = "en",
): Promise<string[]> {
  const { data: challenge, error: cError } = await supabase
    .from("competitive_challenges")
    .select("word_ids")
    .eq("id", challengeId)
    .single();

  if (cError || !challenge) {
    console.error("Error fetching challenge details:", cError);
    return [];
  }

  const { word_ids } = challenge;
  if (!word_ids || word_ids.length === 0) return [];

  // Determine which column to fetch
  const langKey = wordColumn(lang);

  // Also fetch word_en as fallback
  const { data: wordsRows, error: wError } = await supabase
    .from("words")
    .select(`id, word_en, ${langKey}`)
    .in("id", word_ids);

  if (wError) {
    console.error("Error fetching challenge words:", wError);
    return [];
  }

  const wordsMap = new Map();
  wordsRows.forEach((r: any) => {
    // Use localized word if present, else fallback to EN
    const val = r[langKey] || r.word_en;
    wordsMap.set(r.id, val ? val.trim() : val);
  });

  const orderedWords = word_ids
    .map((id: string) => wordsMap.get(id))
    .filter((w: string | undefined): w is string => !!w);

  return orderedWords;
}
