import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Platform } from "react-native";
import { supabase } from "../supabaseClient";
import { clearStoredKeys } from "../utils/localStorageKeys";
import { PRIVACY_POLICY_VERSION } from "../constants/privacy";
import {
  getPlayerProfile,
  ensurePlayerProfile,
  deleteOwnAccount,
  updatePlayerProfileMetadata,
  PlayerProfile,
} from "../supabase/players-repository";

// getPlayerProfile retries the read a few times to ride out the
// on_auth_user_created trigger's insert; if it's still missing after that,
// the row genuinely doesn't exist (e.g. an earlier sign-in whose trigger
// insert failed), so fall back to creating it client-side.
async function fetchOrCreateProfile(userId: string): Promise<PlayerProfile | null> {
  const existing = await getPlayerProfile(userId);
  if (existing) return existing;
  return ensurePlayerProfile(userId);
}

// On web, redirect back to the page the user signed up from — matches the
// original Wordse web app's `emailRedirectTo: window.location.origin`, and
// Supabase's redirect allow-list is already scoped to
// https://wordlune.se. On native, a custom URL scheme is needed
// instead, which requires native config (iOS: CFBundleURLTypes in
// Info.plist, Android: intent-filter in AndroidManifest.xml) that isn't set
// up yet — signup with email confirmation won't complete the redirect on
// native until that's added.
const AUTH_REDIRECT_URL =
  Platform.OS === "web" && (globalThis as any).window
    ? (globalThis as any).window.location.origin
    : "se.wordlune.app://auth-callback";

// Same web/native split as AUTH_REDIRECT_URL, but pointed at the
// ResetPasswordScreen route so a clicked reset-password email link lands
// the user directly on the "set new password" form instead of Home.
const RESET_PASSWORD_REDIRECT_URL =
  Platform.OS === "web" && (globalThis as any).window
    ? `${(globalThis as any).window.location.origin}/reset-password`
    : "se.wordlune.app://reset-password";

// Stamped into player_profiles.metadata.privacy_policy so it's possible to
// tell which version of the policy a given account was shown. A policy update
// requires notifying users, not re-obtaining consent — the legal basis for the
// account itself is contract, not consent — but knowing what they accepted is
// part of being able to demonstrate compliance (Art. 5(2)).
function privacyAcceptanceStamp() {
  return {
    version: PRIVACY_POLICY_VERSION,
    accepted_at: new Date().toISOString(),
  };
}

export type AuthState = "visitor" | "guest" | "registered";

interface AuthContextType {
  authState: AuthState;
  isAuthenticated: boolean;
  loadingInitial: boolean;
  profileLoading: boolean;
  session?: any;
  profile: PlayerProfile | null;
  refreshProfile: () => Promise<void>;
  signUpNewUser: (
    email: string,
    password: string,
    displayName?: string,
    avatarUrl?: string,
  ) => Promise<{ success: boolean; error?: string; errorCode?: string; checkEmail?: boolean }>;
  /** Records that this account accepted PRIVACY_POLICY_VERSION. */
  recordPrivacyAcceptance: () => Promise<void>;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  loginAnonymously: (
    displayName?: string,
    avatarUrl?: string,
  ) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  requestPasswordReset: (email: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  updatePassword: (newPassword: string) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState<any>(undefined);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  const authState: AuthState = !session
    ? "visitor"
    : session?.user?.is_anonymous
      ? "guest"
      : "registered";

  const refreshProfile = async () => {
    if (!session?.user?.id) {
      setProfile(null);
      return;
    }
    setProfileLoading(true);
    try {
      const p = await fetchOrCreateProfile(session.user.id);
      setProfile(p);
    } finally {
      setProfileLoading(false);
    }
  };

  const signUpNewUser = async (
    email: string,
    password: string,
    displayName?: string,
    avatarUrl?: string,
  ) => {
    // `metadata` rides along into player_profiles.metadata via the
    // on_auth_user_created trigger, which already does
    // `coalesce(new.raw_user_meta_data->'metadata', '{}')` — so recording the
    // accepted policy version needs no schema change.
    const options = {
      data: {
        full_name: displayName,
        avatar_url: avatarUrl,
        metadata: { privacy_policy: privacyAcceptanceStamp() },
      },
      emailRedirectTo: AUTH_REDIRECT_URL,
    };
    const { data: signUpData, error } = await supabase.auth.signUp({
      email,
      password,
      options,
    });
    if (error) {
      return { success: false, error: error.message, errorCode: error.code };
    }

    if (signUpData.session) {
      setSession(signUpData.session);
      setIsAuthenticated(true);
      // Wait a moment for trigger to run, then fetch profile
      // Or manually insert profile if not using trigger
      // Here assuming trigger:
      const p = await getPlayerProfile(signUpData.session.user.id);
      setProfile(p);
      return { success: true };
    } else if (signUpData.user) {
      // User created, but no session -> Email confirm required
      return { success: true, checkEmail: true };
    }

    return { success: false, error: "Unknown signup state" };
  };

  const login = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.error("Error logging in:", error.message);
        return { success: false, error: error.message, errorCode: error.code };
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      if (data.session) {
        setIsAuthenticated(true);
        const p = await getPlayerProfile(data.session.user.id);
        setProfile(p);
      }
      return { success: true };
    } catch (e: any) {
      console.error("login error", e);
      return { success: false, error: e?.message || String(e) };
    }
  };

  const loginAnonymously = async (displayName?: string, avatarUrl?: string) => {
    try {
      // Guests get the same stamp: "Play as Guest" creates a real auth.users
      // row, so it is real processing and the notice shown next to the button
      // is the point at which they were informed.
      const options = {
        data: {
          full_name: displayName,
          avatar_url: avatarUrl,
          metadata: { privacy_policy: privacyAcceptanceStamp() },
        },
      };
      const { data, error } = await supabase.auth.signInAnonymously({
        options,
      });

      if (error) {
        console.error("Error logging in anonymously:", error.message);
        return { success: false, error: error.message, errorCode: error.code };
      }

      setSession(data.session);
      if (data.session) {
        setIsAuthenticated(true);
        const p = await fetchOrCreateProfile(data.session.user.id);
        setProfile(p);
      }
      return { success: true };
    } catch (e: any) {
      console.error("loginAnonymously error", e);
      return { success: false, error: e?.message || String(e) };
    }
  };

  const requestPasswordReset = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: RESET_PASSWORD_REDIRECT_URL,
      });
      if (error) {
        console.error("Error requesting password reset:", error.message);
        return { success: false, error: error.message, errorCode: error.code };
      }
      return { success: true };
    } catch (e: any) {
      console.error("requestPasswordReset error", e);
      return { success: false, error: e?.message || String(e) };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        console.error("Error updating password:", error.message);
        return { success: false, error: error.message, errorCode: error.code };
      }
      return { success: true };
    } catch (e: any) {
      console.error("updatePassword error", e);
      return { success: false, error: e?.message || String(e) };
    }
  };

  // For accounts created before the policy existed, or before a version bump.
  // Merges into metadata rather than overwriting it, same read-modify-write
  // shape as updatePlayerSettings().
  const recordPrivacyAcceptance = async () => {
    const userId = session?.user?.id;
    if (!userId) return;
    try {
      await updatePlayerProfileMetadata(userId, {
        privacy_policy: privacyAcceptanceStamp(),
      });
      await refreshProfile();
    } catch (e) {
      console.error("recordPrivacyAcceptance error", e);
    }
  };

  const logout = async () => {
    try {
      // Create a timeout promise that resolves after 1000ms
      const timeoutPromise = new Promise((resolve) =>
        setTimeout(() => resolve({ error: { message: "timeout" } }), 1000),
      );

      // Race the signOut against the timeout
      const result: any = await Promise.race([
        supabase.auth.signOut(),
        timeoutPromise,
      ]);

      if (result?.error) {
        console.warn(
          "Supabase signOut warning (proceeding with local cleanup):",
          result.error.message,
        );
      }
    } catch (err) {
      console.error("Unexpected error during signOut", err);
    } finally {
      // Always clear local state. null, not undefined — SessionGate treats
      // `undefined` as "still loading" and would spin forever otherwise.
      setSession(null);
      setProfile(null);
      setIsAuthenticated(false);

      // Force clear Supabase's persisted session, plus the in-progress round
      // (it holds the secret word). Theme/language/reduce-motion are device
      // preferences and deliberately survive — see localStorageKeys.ts.
      await clearStoredKeys({ devicePreferences: false });
    }
  };

  const deleteAccount = async () => {
    const result = await deleteOwnAccount();
    if (!result.success) {
      return result;
    }

    // Account (and its auth.users row) is gone server-side at this point —
    // best-effort signOut to invalidate the now-dangling refresh token, but
    // local state must be cleared regardless of whether that call succeeds,
    // same reasoning as logout()'s try/finally above.
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // ignore
    } finally {
      // null, not undefined — SessionGate treats `undefined` as "still
      // loading" and would spin forever otherwise.
      setSession(null);
      setProfile(null);
      setIsAuthenticated(false);

      // Unlike logout(), this also clears the device preferences — the account
      // is gone, so nothing belonging to it should be left on the device.
      await clearStoredKeys({ devicePreferences: true });
    }

    return result;
  };

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        // getSession() can hang (e.g. a stuck AsyncStorage read) — race it
        // against a timeout so `session` always leaves its initial
        // `undefined`, since SessionGate treats "still undefined" as "still
        // loading" and would otherwise spin forever for a logged-out visitor.
        const timeoutPromise = new Promise((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, timedOut: true }), 5000),
        );
        const result: any = await Promise.race([supabase.auth.getSession(), timeoutPromise]);
        if (result?.timedOut) {
          console.warn("checkAuthStatus: getSession() timed out, treating as no session");
        }
        const data = result.data;
        setSession(data.session);

        if (data.session) {
          setIsAuthenticated(true);
          // Don't await profile to unblock initialization
          setProfileLoading(true);
          fetchOrCreateProfile(data.session.user.id)
            .then((p) => setProfile(p))
            .catch((err) => console.error("fetchOrCreateProfile error", err))
            .finally(() => setProfileLoading(false));
        } else {
          setIsAuthenticated(false);
          setProfile(null);
        }
      } catch (err) {
        console.error("checkAuthStatus error", err);
        setSession(null);
        setIsAuthenticated(false);
        setProfile(null);
      } finally {
        setLoadingInitial(false);
      }
    };
    checkAuthStatus();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      setSession(session);
      if (session) {
        setIsAuthenticated(true);
        // Start fetching profile but don't block
        setProfileLoading(true);
        fetchOrCreateProfile(session.user.id)
          .then((p) => setProfile(p))
          .catch((err) => console.error("fetchOrCreateProfile error", err))
          .finally(() => setProfileLoading(false));
      } else {
        setIsAuthenticated(false);
        setProfile(null);
      }
      // Unblock UI immediately after processing session state
      setLoadingInitial(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        authState,
        isAuthenticated,
        session,
        profile,
        loadingInitial,
        profileLoading,
        refreshProfile,
        signUpNewUser,
        recordPrivacyAcceptance,
        login,
        loginAnonymously,
        requestPasswordReset,
        updatePassword,
        logout,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
