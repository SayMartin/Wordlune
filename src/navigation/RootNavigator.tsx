import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useTranslation } from "react-i18next";
import MainTabs from "./MainTabs";
import SignupScreen from "../screens/SignupScreen";
import LoginScreen from "../screens/LoginScreen";
import SignoutScreen from "../screens/SignoutScreen";
import ResetPasswordScreen from "../screens/ResetPasswordScreen";
import PrivacyPolicyScreen from "../screens/PrivacyPolicyScreen";
import DeleteAccountScreen from "../screens/DeleteAccountScreen";
import NotFoundScreen from "../screens/NotFoundScreen";
import WebCentered from "../components/WebCentered";
import type { RootStackParamList } from "./types";

export type { RootStackParamList, MainTabParamList, AppParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Signup/Login/ResetPassword/PrivacyPolicy/DeleteAccount are NOT wrapped in
// WebCentered: they use PageScrollView, which puts the 896px column on the
// content container instead. Wrapping them would shrink the scroll container
// back to 896px, stranding the scrollbar mid-viewport and leaving the mouse
// wheel dead everywhere outside the column.
//
// Signout and NotFound have no ScrollView of their own, so they still need the
// wrapper to get the same measure.
const CenteredSignoutScreen = () => (
  <WebCentered>
    <SignoutScreen />
  </WebCentered>
);
const CenteredNotFoundScreen = () => (
  <WebCentered>
    <NotFoundScreen />
  </WebCentered>
);

// Mirrors Wordse's src/router.jsx route tree. Home/Game/Progress/Settings/
// About live in the bottom-tab navigator (MainTabs), matching the web's
// persistent top nav; Login/Signup/Signout push as full-screen stack
// routes over the tabs. Real Duel mode lives inside GameScreen —
// there is no standalone Multiplayer route (the old prototype was removed).
// Session gating for Game/Progress/Settings (SessionGate, mirroring the web's
// SessionRequiredRoute) is wired up in MainTabs.tsx, not here. NotFound mirrors
// the web app's src/pages/NotFound.tsx; on web it's reached via the "*" linking
// path in App.tsx (any URL that doesn't match a configured route), matching
// react-router's catch-all behavior in the old app.
export default function RootNavigator() {
  // Titles are resolved here rather than per screen so they can go through
  // t(): without an explicit title the native stack header falls back to the
  // route name, which surfaced raw identifiers like "PrivacyPolicy" and
  // "ResetPassword" to users — untranslated and run together. Calling
  // useTranslation() here also means the headers re-render on a language
  // change, which a static options object would not.
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        // The gradient is painted once behind the whole app (App.tsx); an
        // opaque scene background here would cover it on every screen.
        contentStyle: { backgroundColor: "transparent" },
      }}
    >
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen
        name="Signup"
        component={SignupScreen}
        options={{ headerShown: true, title: t("signup", { defaultValue: "Sign Up" }) }}
      />
      <Stack.Screen
        name="Login"
        component={LoginScreen}
        options={{ headerShown: true, title: t("login", { defaultValue: "Log In" }) }}
      />
      <Stack.Screen
        name="Signout"
        component={CenteredSignoutScreen}
        options={{ headerShown: true, title: t("logout", { defaultValue: "Log Out" }) }}
      />
      <Stack.Screen
        name="ResetPassword"
        component={ResetPasswordScreen}
        options={{ headerShown: true, title: t("reset_password", { defaultValue: "Reset Password" }) }}
      />
      {/* Both reachable without a session — a visitor must be able to read the
          policy before signing up, and Google Play's reviewers need both URLs
          without credentials. Neither is wrapped in SessionGate. */}
      <Stack.Screen
        name="PrivacyPolicy"
        component={PrivacyPolicyScreen}
        options={{ headerShown: true, title: t("privacy_policy", { defaultValue: "Privacy Policy" }) }}
      />
      <Stack.Screen
        name="DeleteAccount"
        component={DeleteAccountScreen}
        options={{ headerShown: true, title: t("delete_account", { defaultValue: "Delete Account" }) }}
      />
      <Stack.Screen
        name="NotFound"
        component={CenteredNotFoundScreen}
        options={{ headerShown: true, title: t("not_found_title", { defaultValue: "Not Found" }) }}
      />
    </Stack.Navigator>
  );
}
