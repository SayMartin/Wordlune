import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import HomeScreen from "../screens/HomeScreen";
import GameScreen from "../screens/GameScreen";
import ProgressScreen from "../screens/ProgressScreen";
import SettingsScreen from "../screens/SettingsScreen";
import AboutScreen from "../screens/AboutScreen";
import HeaderRight from "../components/HeaderRight";
import HeaderLeft from "../components/HeaderLeft";
import SessionGate from "../components/SessionGate";
import WebTopNav from "../components/WebTopNav";
import WebFooter from "../components/WebFooter";
import WebCentered from "../components/WebCentered";
import { useTheme } from "../theme/ThemeProvider";
import type { MainTabParamList } from "./types";

const isWeb = Platform.OS === "web";

// Matches Wordse's router.jsx: /game, /progress, and /settings are wrapped in
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
const GatedSettingsScreen = () => (
  <WebCentered>
    <SessionGate>
      <SettingsScreen />
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
  Settings: "👤",
  About: "ℹ️",
};

// React Navigation invokes these as plain functions (BottomTabView calls
// `tabBar({...})`, Header calls `headerLeft({...})`/`headerRight({...})`, and
// BottomTabItem calls `renderIcon(scene)`) — they are render props, never
// mounted as component types. Defining them at module scope anyway keeps the
// references stable across renders and keeps react/no-unstable-nested-components
// quiet, so a genuine instance of that mistake still stands out.
const renderWebTopNav = (props: React.ComponentProps<typeof WebTopNav>) => <WebTopNav {...props} />;
const renderNoTitle = () => null;
const renderHeaderLeft = () => <HeaderLeft />;
const renderHeaderRight = () => <HeaderRight />;
const makeTabBarIcon =
  (routeName: keyof MainTabParamList) =>
  ({ color }: { color: string }) => <Text style={[styles.tabIcon, { color }]}>{ICONS[routeName]}</Text>;

function TabNavigator() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      // On web, WebTopNav (rendered via `tabBar`) replaces both the bottom
      // tab bar and each screen's per-page header — a single persistent top
      // nav, mirroring Wordse's HeaderCopy.tsx, instead of native's bottom
      // tabs + per-screen header.
      tabBar={isWeb ? renderWebTopNav : undefined}
      screenOptions={({ route }) => ({
        headerShown: !isWeb,
        tabBarPosition: isWeb ? "top" : "bottom",
        // No title text in the native header — just the logo+flag (headerLeft)
        // and greeting+logout (headerRight) clusters, mirroring how the web
        // top nav doesn't show a "current page" label either.
        headerTitle: renderNoTitle,
        headerLeft: renderHeaderLeft,
        headerRight: renderHeaderRight,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        tabBarIcon: makeTabBarIcon(route.name as keyof MainTabParamList),
      })}
    >
      <Tab.Screen name="Home" component={GatedHomeScreen} options={{ title: t("home", { defaultValue: "Home" }) }} />
      <Tab.Screen name="Game" component={GatedGameScreen} options={{ title: t("game", { defaultValue: "Game" }) }} />
      <Tab.Screen name="Progress" component={GatedProgressScreen} options={{ title: t("progress", { defaultValue: "Progress" }) }} />
      <Tab.Screen name="Settings" component={GatedSettingsScreen} options={{ title: t("settings", { defaultValue: "Settings" }) }} />
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
  tabIcon: { fontSize: 20 },
});
