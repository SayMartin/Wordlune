/**
 * Wordse (React Native) — ported from the Wordse web app.
 *
 * @format
 */

import "./src/i18n/i18n";
import React, { useEffect } from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoadingProvider } from "./src/context/LoadingContext";
import RootNavigator from "./src/navigation/RootNavigator";

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
