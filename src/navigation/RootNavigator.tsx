import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
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

// These full-screen stack routes (unlike MainTabs' screens) have no other
// web-width handling of their own, so each gets the same 896px centering.
const CenteredSignupScreen = () => (
  <WebCentered>
    <SignupScreen />
  </WebCentered>
);
const CenteredLoginScreen = () => (
  <WebCentered>
    <LoginScreen />
  </WebCentered>
);
const CenteredSignoutScreen = () => (
  <WebCentered>
    <SignoutScreen />
  </WebCentered>
);
const CenteredResetPasswordScreen = () => (
  <WebCentered>
    <ResetPasswordScreen />
  </WebCentered>
);
const CenteredPrivacyPolicyScreen = () => (
  <WebCentered>
    <PrivacyPolicyScreen />
  </WebCentered>
);
const CenteredDeleteAccountScreen = () => (
  <WebCentered>
    <DeleteAccountScreen />
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
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Signup" component={CenteredSignupScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Login" component={CenteredLoginScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Signout" component={CenteredSignoutScreen} options={{ headerShown: true }} />
      <Stack.Screen name="ResetPassword" component={CenteredResetPasswordScreen} options={{ headerShown: true }} />
      {/* Both reachable without a session — a visitor must be able to read the
          policy before signing up, and Google Play's reviewers need both URLs
          without credentials. Neither is wrapped in SessionGate. */}
      <Stack.Screen name="PrivacyPolicy" component={CenteredPrivacyPolicyScreen} options={{ headerShown: true }} />
      <Stack.Screen name="DeleteAccount" component={CenteredDeleteAccountScreen} options={{ headerShown: true }} />
      <Stack.Screen name="NotFound" component={CenteredNotFoundScreen} options={{ headerShown: true }} />
    </Stack.Navigator>
  );
}
