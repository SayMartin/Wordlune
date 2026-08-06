/**
 * Wordse (React Native) — ported from the Wordse web app.
 *
 * @format
 */

import "./src/i18n/i18n";
import React from "react";
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { AuthProvider } from "./src/context/AuthContext";
import { LoadingProvider } from "./src/context/LoadingContext";
import RootNavigator from "./src/navigation/RootNavigator";

// On web this app is a phone-sized SPA, not a responsive site — render it
// centered in a phone-proportioned frame instead of stretched full-bleed
// across the browser window. No-op on native, where children render as-is.
function WebPhoneFrame({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== "web") {
    return <>{children}</>;
  }
  return (
    <View style={webStyles.backdrop}>
      <View style={webStyles.phone}>{children}</View>
    </View>
  );
}

const webStyles = StyleSheet.create({
  backdrop: {
    height: "100vh" as unknown as number,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0b0d12",
  },
  phone: {
    width: "100%",
    maxWidth: 430,
    height: "100%",
    maxHeight: 900,
    overflow: "hidden",
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
  },
});

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
    <WebPhoneFrame>
      <SafeAreaProvider>
        <ThemeProvider>
          <LoadingProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </LoadingProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </WebPhoneFrame>
  );
}

export default App;
