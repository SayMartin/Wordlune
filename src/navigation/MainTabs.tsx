import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import HomeScreen from "../screens/HomeScreen";
import GameScreen from "../screens/GameScreen";
import ProgressScreen from "../screens/ProgressScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AboutScreen from "../screens/AboutScreen";
import HeaderRight from "../components/HeaderRight";
import SessionGate from "../components/SessionGate";
import WebTopNav from "../components/WebTopNav";
import WebFooter from "../components/WebFooter";
import WebCentered from "../components/WebCentered";
import { useTheme } from "../theme/ThemeProvider";
import type { MainTabParamList } from "./types";

const isWeb = Platform.OS === "web";

// Matches Wordse's router.jsx: /game, /progress, and /profile are wrapped in
// SessionRequiredRoute (at least a guest session required); /home and
// /about are open to visitors.
const GatedHomeScreen = () => (
  <WebCentered>
    <HomeScreen />
  </WebCentered>
);
const GatedGameScreen = () => (
  <WebCentered>
    <SessionGate>
      <GameScreen />
    </SessionGate>
  </WebCentered>
);
const GatedProgressScreen = () => (
  <WebCentered>
    <SessionGate>
      <ProgressScreen />
    </SessionGate>
  </WebCentered>
);
const GatedProfileScreen = () => (
  <WebCentered>
    <SessionGate>
      <ProfileScreen />
    </SessionGate>
  </WebCentered>
);
const GatedAboutScreen = () => (
  <WebCentered>
    <AboutScreen />
  </WebCentered>
);

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Home: "🏠",
  Game: "🎮",
  Progress: "📈",
  Profile: "👤",
  About: "ℹ️",
};

function TabNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      // On web, WebTopNav (rendered via `tabBar`) replaces both the bottom
      // tab bar and each screen's per-page header — a single persistent top
      // nav, mirroring Wordse's HeaderCopy.tsx, instead of native's bottom
      // tabs + per-screen header.
      tabBar={isWeb ? (props) => <WebTopNav {...props} /> : undefined}
      screenOptions={({ route }) => ({
        headerShown: !isWeb,
        tabBarPosition: isWeb ? "top" : "bottom",
        headerRight: () => <HeaderRight />,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarIcon: ({ color }: { color: string }) => (
          <Text style={{ fontSize: 20, color }}>{ICONS[route.name as keyof MainTabParamList]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={GatedHomeScreen} options={{ title: t("home", { defaultValue: "Home" }) }} />
      <Tab.Screen name="Game" component={GatedGameScreen} options={{ title: t("game", { defaultValue: "Game" }) }} />
      <Tab.Screen name="Progress" component={GatedProgressScreen} options={{ title: t("progress", { defaultValue: "Progress" }) }} />
      <Tab.Screen name="Profile" component={GatedProfileScreen} options={{ title: t("my_profile", { defaultValue: "Profile" }) }} />
      <Tab.Screen name="About" component={GatedAboutScreen} options={{ title: t("about", { defaultValue: "About" }) }} />
    </Tab.Navigator>
  );
}

export default function MainTabs() {
  const { colors } = useTheme();

  if (!isWeb) {
    return <TabNavigator />;
  }

  // Web: WebTopNav spans full width (each screen's own content is centered
  // via WebCentered above); WebFooter matches Wordse's persistent page footer.
  return (
    <View style={[styles.webPage, { backgroundColor: colors.background }]}>
      <TabNavigator />
      <WebFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  webPage: { flex: 1 },
});
