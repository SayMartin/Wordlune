/**
 * Wordse (React Native) — ported from the Wordse web app.
 *
 * @format
 */

import "./src/i18n/i18n";
import React from "react";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { AuthProvider } from "./src/context/AuthContext";
import { LoadingProvider } from "./src/context/LoadingContext";
import RootNavigator from "./src/navigation/RootNavigator";

function AppContent() {
  const { theme, colors } = useTheme();
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
