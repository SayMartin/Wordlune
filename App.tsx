/**
 * Wordse (React Native) — ported from the Wordse web app.
 *
 * @format
 */

import "./src/i18n/i18n";
import React, { useEffect } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoadingProvider } from "./src/context/LoadingContext";
import RootNavigator, { type RootStackParamList } from "./src/navigation/RootNavigator";

// Mirrors the old web app's react-router paths (src/router.jsx). Native has no URL bar so
// this is web-only in effect, but the config lives here regardless of platform. Without an
// explicit "*" -> NotFound mapping, an unrecognized URL falls through to the initial route
// (Home) instead of showing the 404 screen, silently swallowing typos in the address bar.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [],
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
      NotFound: "*",
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
