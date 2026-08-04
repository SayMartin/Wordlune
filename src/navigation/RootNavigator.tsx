import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import MultiplayerScreen from "../screens/MultiplayerScreen";
import SettingsScreen from "../screens/SettingsScreen";
import SignupScreen from "../screens/SignupScreen";
import SigninScreen from "../screens/SigninScreen";
import SignoutScreen from "../screens/SignoutScreen";
import type { RootStackParamList } from "./types";

export type { RootStackParamList, MainTabParamList, AppParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Mirrors Wordse's src/router.jsx route tree. Home/Game/Progress/Profile/
// About live in the bottom-tab navigator (MainTabs), matching the web's
// persistent top nav; Signin/Signup/Signout push as full-screen stack
// routes over the tabs. Settings/Multiplayer are kept reachable but unused
// (Settings mirrors Profile like the web router; Multiplayer is the
// superseded standalone prototype — Duel mode lives inside GameScreen).
// Session gating for Game/Progress/Profile still needs a real auth-gate
// (e.g. redirect to Signin when useAuth().isAuthenticated is false).
export default function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Multiplayer" component={MultiplayerScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Signin" component={SigninScreen} options={{ headerShown: true }} />
      <Stack.Screen name="Signout" component={SignoutScreen} options={{ headerShown: true }} />
    </Stack.Navigator>
  );
}
