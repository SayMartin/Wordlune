import AsyncStorage from "@react-native-async-storage/async-storage";

// Every AsyncStorage key the app owns, in one place, plus the wipe used on
// logout and account deletion. Previously each key was a module-local const in
// the file that used it, which made it impossible to clear them all from
// AuthContext without hardcoding a second copy of each string.

/**
 * supabase-js persists the whole session — access token, refresh token, and
 * the decoded user object (id, email, user_metadata) — under
 * `sb-<projectRef>-auth-token`. The project ref isn't known at build time, so
 * this matches by shape rather than by an exact key.
 */
export const isSupabaseAuthKey = (key: string) =>
  key.startsWith("sb-") && key.endsWith("-auth-token");

/**
 * In-progress practice round. Holds the secret word and the player's guesses,
 * so it's account state rather than a device preference — cleared on logout as
 * well as on deletion, which matters on a shared computer.
 */
export const GAME_STATE_KEY = "wordlune:game:v1";

// Device preferences. These survive logout deliberately: they aren't personal
// data on their own and re-picking a theme and language after every sign-out
// is a worse experience than the (nil) privacy gain. Account deletion clears
// them anyway, since at that point nothing about the account should remain.
export const THEME_KEY = "wordlune:theme";
export const LANG_KEY = "wordlune:lang";
export const REDUCE_MOTION_KEY = "wordlune:reduceMotion";

export const DEVICE_PREFERENCE_KEYS: readonly string[] = [
  THEME_KEY,
  LANG_KEY,
  REDUCE_MOTION_KEY,
];

/**
 * Wipes the Supabase session and the in-progress round, and — when
 * `devicePreferences` is set — the theme/language/reduce-motion keys too.
 *
 * Best-effort by design: the caller has already cleared React state, and a
 * failed storage wipe must never block logout or account deletion from
 * completing (same reasoning as logout()'s try/finally in AuthContext).
 */
export async function clearStoredKeys({
  devicePreferences,
}: {
  devicePreferences: boolean;
}): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const toRemove = allKeys.filter(
      (key) =>
        isSupabaseAuthKey(key) ||
        key === GAME_STATE_KEY ||
        (devicePreferences && DEVICE_PREFERENCE_KEYS.includes(key)),
    );
    if (toRemove.length > 0) {
      await AsyncStorage.removeMany(toRemove);
    }
  } catch {
    // ignore
  }
}
