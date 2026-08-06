import "react-native-url-polyfill/auto";
import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Don't throw at module load time — allow the app to render in dev/test
  // when env vars aren't set. Network calls will fail until properly configured.
  // Log a visible warning to help debugging.
  // eslint-disable-next-line no-console
  console.warn(
    "SUPABASE_URL or SUPABASE_ANON_KEY not set. Supabase disabled."
  );
}

function createStubClient() {
  const noop = () => {};
  const asyncNull = async () => ({ data: null });

  const fromBuilder = () => {
    const chain: any = {
      select: async () => ({ data: null }),
      eq: (_: string, __: any) => chain,
      single: async () => ({ data: null }),
      order: (_: string, __: any) => chain,
      limit: (_: number) => chain,
      insert: async () => ({ data: null }),
    };
    return chain;
  };

  return {
    auth: {
      getUser: asyncNull,
      onAuthStateChange: (_: any) => ({ data: { subscription: { unsubscribe: noop } } }),
      signInWithOtp: async () => ({ data: null }),
      signOut: async () => ({ error: null }),
    },
    from: (_: string) => fromBuilder(),
    channel: (_: string) => ({ on: noop, subscribe: (cb: any) => cb && cb("SUBSCRIBED") }),
    removeChannel: noop,
  } as any;
}

export const supabase: any =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // Web needs this true so the session from an email-confirmation /
          // magic-link redirect is picked up from the URL on page load;
          // native handles the redirect via a custom URL scheme instead.
          detectSessionInUrl: Platform.OS === "web",
        },
        realtime: { params: { eventsPerSecond: 10 } },
      })
    : createStubClient();
