/**
 * Wordlune (React Native) — ported from the original Wordse web app.
 *
 * @format
 */

import "./src/i18n/i18n";
import React, { useEffect } from "react";
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, type LinkingOptions } from "@react-navigation/native";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import AppBackground from "./src/theme/AppBackground";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LoadingProvider } from "./src/context/LoadingContext";
import RootNavigator, { type RootStackParamList } from "./src/navigation/RootNavigator";

// Mirrors the old web app's react-router paths (src/router.jsx). On web these are real
// URLs; on native the same paths are reachable as deep links through the custom scheme
// (AndroidManifest.xml declares the matching intent-filter), which is what makes the
// password-reset and email-confirmation redirects in AuthContext able to land in the app.
//
// The "*" -> NotFound mapping is web-only — see the comment on it below.
const isWeb = Platform.OS === "web";

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
          // Transparent, not colors.background: the gradient is painted once
          // behind the whole app (AppBackground on native, <body> on web), and
          // React Navigation would otherwise cover it with an opaque scene
          // container on every screen. Every navigator here also passes a
          // transparent contentStyle/sceneStyle for the same reason.
          background: "transparent",
          // Headers and the native tab bar have content scrolling underneath
          // them, so they need the opaque surface rather than the glass one.
          card: colors.surfaceSolid,
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

// The gradient sits in a plain View behind the navigator rather than inside it,
// so it survives every screen transition instead of being torn down and redrawn
// with each one.
//
// The base fill is native-only, and deliberately so: on web the gradient is
// painted onto <body> (webTheme.ts), and any opaque colour here would cover it
// along with the grain that sits behind #root. On native there is no document
// to paint, so this View is the bottom of the stack and needs a colour of its
// own for the moment before AppBackground's SVG has drawn.
function AppShell() {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, !isWeb && { backgroundColor: colors.backgroundDeep }]}>
      <AppBackground />
      <AppContent />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LoadingProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </LoadingProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default App;
