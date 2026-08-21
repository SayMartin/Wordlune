/**
 * Wordlune (React Native) — ported from the original Wordse web app.
 *
 * @format
 */

import "./src/i18n/i18n";
import React, { useEffect } from "react";
import { Platform, StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoadingProvider } from "./src/context/LoadingContext";
import RootNavigator, { type RootStackParamList } from "./src/navigation/RootNavigator";

// Mirrors the old web app's react-router paths (src/router.jsx). On web these are real
// URLs; on native the same paths are reachable as deep links through the custom scheme
// (AndroidManifest.xml declares the matching intent-filter), which is what makes the
// password-reset and email-confirmation redirects in AuthContext able to land in the app.
//
// The "*" -> NotFound mapping is web-only — see the comment on it below.
const linking: LinkingOptions<RootStackParamList> = {
  // The custom scheme matches the intent-filter in AndroidManifest.xml and the
  // redirect URLs AuthContext builds for password reset / email confirmation.
  // The https origin lets the same paths work as web links.
  prefixes: ["se.wordlune.app://", "https://wordlune.appfinningar.se"],
  config: {
    screens: {
      Main: {
        screens: {
          Home: "",
          Game: "game",
          Progress: "progress",
          Settings: "settings",
          About: "about",
        },
      },
      Signup: "signup",
      Login: "login",
      Signout: "signout",
      ResetPassword: "reset-password",
      // /privacy is the URL given to Google Play as the privacy policy, and
      // /delete-account satisfies Play's separate account-deletion URL
      // requirement. Both must stay above the "*" catch-all.
      PrivacyPolicy: "privacy",
      DeleteAccount: "delete-account",
      // Web only, deliberately. The catch-all exists to mirror react-router's
      // 404 behaviour in an address bar — mistype a URL, get NotFound. Native
      // has no address bar, and there any unrecognised deep link should simply
      // open the app rather than dead-end on a 404 the user can't have caused.
      //
      // It also has to be web-only to be usable at all: the Expo dev client
      // launches the app via `se.wordlune.app://expo-development-client/...`,
      // which matches the scheme prefix above and resolves to no known route —
      // so with "*" active on native, every `npm run android` start landed
      // straight on NotFound.
      ...(Platform.OS === "web" ? { NotFound: "*" as const } : {}),
    },
  },
};

function AppContent() {
  const { theme, colors, setTheme } = useTheme();
  const { profile } = useAuth();

  // Sync theme from the signed-in user's saved profile settings, matching
  // the web app's App.tsx. Only overrides local state when a saved
  // preference exists — visitors/guests without a profile keep whatever
  // theme is already active.
  useEffect(() => {
    const savedTheme = profile?.metadata?.settings?.theme;
    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
    }
  }, [profile, setTheme]);

  return (
    <NavigationContainer
      linking={linking}
      theme={{
        dark: theme === "dark",
        colors: {
          primary: colors.accent,
          background: colors.background,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          notification: colors.accent,
        },
        fonts: {
          regular: { fontFamily: "System", fontWeight: "400" },
          medium: { fontFamily: "System", fontWeight: "500" },
          bold: { fontFamily: "System", fontWeight: "700" },
          heavy: { fontFamily: "System", fontWeight: "900" },
        },
      }}
    >
      <StatusBar barStyle={theme === "dark" ? "light-content" : "dark-content"} />
      <RootNavigator />
    </NavigationContainer>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LoadingProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </LoadingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
