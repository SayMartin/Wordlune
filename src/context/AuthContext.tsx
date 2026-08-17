import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabaseClient";
import {
  getPlayerProfile,
  ensurePlayerProfile,
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
// https://wordse.appfinningar.se. On native, a custom URL scheme is needed
// instead, which requires native config (iOS: CFBundleURLTypes in
// Info.plist, Android: intent-filter in AndroidManifest.xml) that isn't set
// up yet — signup with email confirmation won't complete the redirect on
// native until that's added.
const AUTH_REDIRECT_URL =
  Platform.OS === "web" && (globalThis as any).window
    ? (globalThis as any).window.location.origin
    : "se.wordse.app://auth-callback";

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
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  loginAnonymously: (
    displayName?: string,
    avatarUrl?: string,
  ) => Promise<{ success: boolean; error?: string; errorCode?: string }>;
  logout: () => Promise<void>;
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
    const options = {
      data: { full_name: displayName, avatar_url: avatarUrl },
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
      const options = {
        data: { full_name: displayName, avatar_url: avatarUrl },
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
      // Always clear local state
      setSession(undefined);
      setProfile(null);
      setIsAuthenticated(false);

      // Force clear Supabase's persisted session if possible
      try {
        // Supabase uses keys like sb-<projectRef>-auth-token
        const allKeys = await AsyncStorage.getAllKeys();
        const authKeys = allKeys.filter(
          (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
        );
        if (authKeys.length > 0) {
          await AsyncStorage.removeMany(authKeys);
        }
      } catch (e) {
        // ignore
      }
    }
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
        login,
        loginAnonymously,
        logout,
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
