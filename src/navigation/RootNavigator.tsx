import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import SettingsScreen from "../screens/SettingsScreen";
import SignupScreen from "../screens/SignupScreen";
import SigninScreen from "../screens/SigninScreen";
import SignoutScreen from "../screens/SignoutScreen";
import NotFoundScreen from "../screens/NotFoundScreen";
import WebCentered from "../components/WebCentered";
import type { RootStackParamList } from "./types";

export type { RootStackParamList, MainTabParamList, AppParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

// These full-screen stack routes (unlike MainTabs' screens) have no other
// web-width handling of their own, so each gets the same 896px centering.
const CenteredSettingsScreen = () => (
  <WebCentered>
    <SettingsScreen />
  </WebCentered>
);
const CenteredSignupScreen = () => (
  <WebCentered>
    <SignupScreen />
  </WebCentered>
);
const CenteredSigninScreen = () => (
  <WebCentered>
    <SigninScreen />
  </WebCentered>
);
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

// Mirrors Wordse's src/router.jsx route tree. Home/Game/Progress/Profile/
// About live in the bottom-tab navigator (MainTabs), matching the web's
// persistent top nav; Signin/Signup/Signout push as full-screen stack
// routes over the tabs. Settings is kept reachable but unused (mirrors
// Profile like the web router). Real Duel mode lives inside GameScreen —
// there is no standalone Multiplayer route (the old prototype was removed).
// Session gating for Game/Progress/Profile (SessionGate, mirroring the web's
// SessionRequiredRoute) is wired up in MainTabs.tsx, not here. NotFound mirrors
// the web app's src/pages/NotFound.tsx; on web it's reached via the "*" linking
// path in App.tsx (any URL that doesn't match a configured route), matching
// react-router's catch-all behavior in the old app.
export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Settings" component={CenteredSettingsScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Signup" component={CenteredSignupScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Signin" component={CenteredSigninScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Signout" component={CenteredSignoutScreen} options={{ headerShown: true }} />
      <Stack.Screen name="NotFound" component={CenteredNotFoundScreen} options={{ headerShown: true }} />
    </Stack.Navigator>
  );
}
