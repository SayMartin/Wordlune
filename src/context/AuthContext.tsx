import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../supabaseClient";
import {
  getPlayerProfile,
  PlayerProfile,
} from "../supabase/players-repository";

// Custom URL scheme for the email-confirmation deep link. Requires native
// config (iOS: CFBundleURLTypes in Info.plist, Android: intent-filter in
// AndroidManifest.xml) that isn't set up yet — signup with email
// confirmation won't complete the redirect until that's added.
const AUTH_REDIRECT_URL = "wordsenative://auth-callback";

export type AuthState = "visitor" | "guest" | "registered";

interface AuthContextType {
  authState: AuthState;
  isAuthenticated: boolean;
  loadingInitial: boolean;
  session?: any;
  profile: PlayerProfile | null;
  refreshProfile: () => Promise<void>;
  signUpNewUser: (
    email: string,
    password: string,
    displayName?: string,
    avatarUrl?: string,
  ) => Promise<{ success: boolean; error?: string; checkEmail?: boolean }>;
  login: (
    email: string,
    password: string,
  ) => Promise<{ success: boolean; error?: string }>;
  loginAnonymously: (
    displayName?: string,
    avatarUrl?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [session, setSession] = useState<any>(undefined);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);

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
    const p = await getPlayerProfile(session.user.id);
    setProfile(p);
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
      return { success: false, error: error.message };
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
        return { success: false, error: error.message };
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
        return { success: false, error: error.message };
      }

      setSession(data.session);
      if (data.session) {
        setIsAuthenticated(true);
        // Wait for trigger to create profile
        // A small delay might be needed or retry logic in getPlayerProfile or UI
        // But usually Supabase is fast enough.
        const p = await getPlayerProfile(data.session.user.id);
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
        const { data } = await supabase.auth.getSession();
        setSession(data.session);

        if (data.session) {
          setIsAuthenticated(true);
          // Don't await profile to unblock initialization
          getPlayerProfile(data.session.user.id).then((p) => setProfile(p));
        } else {
          setIsAuthenticated(false);
          setProfile(null);
        }
      } catch (err) {
        console.error("checkAuthStatus error", err);
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
        getPlayerProfile(session.user.id).then((p) => setProfile(p));
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
