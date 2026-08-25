import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useIsFocused } from "@react-navigation/native";
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
import { useTheme } from "../theme/ThemeProvider";
import type { MainTabParamList } from "./types";

const isWeb = Platform.OS === "web";

// Matches Wordse's router.jsx: /game, /progress, and /settings are wrapped in
// SessionRequiredRoute (at least a guest session required); /home and
// /about are open to visitors.
// No WebCentered wrapper here: each of these screens uses PageScrollView, which
// applies the 896px column to its *content container* rather than to the scroll
// container. Wrapping them would shrink the scroll container back to 896px and
// reintroduce the problem — a scrollbar stranded mid-viewport and a mouse wheel
// that does nothing outside the column. SessionGate's visitor card centres
// itself (maxWidth: 400), so it needs no wrapper either.
/**
 * Hides a tab's scene while it isn't the focused one. Web only.
 *
 * @react-navigation/bottom-tabs delegates that to react-native-screens, whose
 * ENABLE_SCREENS defaults to `Platform.OS` being ios/android/windows — so on
 * web it is off, MaybeScreen falls back to a plain View, and BottomTabView
 * separates the scenes with nothing but `zIndex: -1` (see its MaybeScreen call).
 * Every tab you have visited therefore stays mounted *and painted*, stacked
 * behind the focused one.
 *
 * That was invisible for as long as every scene painted an opaque
 * `theme.colors.background` over the ones underneath. It stopped being true
 * when the gradient moved behind the whole app and the scenes went transparent
 * (App.tsx), and showed up as a stale screen — most visibly SessionGate's
 * sign-in card — lingering behind whatever tab you switched to.
 *
 * `display: none` rather than returning null: the children stay mounted, so a
 * half-finished game or a scroll position survives the trip to another tab,
 * exactly as it did before.
 *
 * The root stack needs none of this — NativeStackView sets an explicit
 * per-screen `display` on web.
 */
function TabScene({ children }: { children: React.ReactNode }) {
  const isFocused = useIsFocused();
  if (!isWeb) return <>{children}</>;
  return <View style={[styles.scene, !isFocused && styles.sceneHidden]}>{children}</View>;
}

const TabHomeScreen = () => (
  <TabScene>
    <HomeScreen />
  </TabScene>
);
const TabAboutScreen = () => (
  <TabScene>
    <AboutScreen />
  </TabScene>
);
const GatedGameScreen = () => (
  <TabScene>
    <SessionGate>
      <GameScreen />
    </SessionGate>
  </TabScene>
);
const GatedProgressScreen = () => (
  <TabScene>
    <SessionGate>
      <ProgressScreen />
    </SessionGate>
  </TabScene>
);
const GatedSettingsScreen = () => (
  <TabScene>
    <SessionGate>
      <SettingsScreen />
    </SessionGate>
  </TabScene>
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
        // Transparent so App.tsx's gradient shows through the scene; the tab
        // bar and header stay opaque, since content scrolls underneath them.
        sceneStyle: { backgroundColor: "transparent" },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surfaceSolid, borderTopColor: colors.border },
        headerStyle: { backgroundColor: colors.surfaceSolid },
        headerTintColor: colors.text,
        tabBarIcon: makeTabBarIcon(route.name as keyof MainTabParamList),
      })}
    >
      <Tab.Screen name="Home" component={TabHomeScreen} options={{ title: t("home", { defaultValue: "Home" }) }} />
      <Tab.Screen name="Game" component={GatedGameScreen} options={{ title: t("game", { defaultValue: "Game" }) }} />
      <Tab.Screen name="Progress" component={GatedProgressScreen} options={{ title: t("progress", { defaultValue: "Progress" }) }} />
      <Tab.Screen name="Settings" component={GatedSettingsScreen} options={{ title: t("settings", { defaultValue: "Settings" }) }} />
      <Tab.Screen name="About" component={TabAboutScreen} options={{ title: t("about", { defaultValue: "About" }) }} />
    </Tab.Navigator>
  );
}

export default function MainTabs() {
  if (!isWeb) {
    return <TabNavigator />;
  }

  // Web: WebTopNav spans full width (each screen's own content is centered
  // via PageScrollView's content container); WebFooter matches Wordse's footer.
  return (
    <View style={styles.webPage}>
      <TabNavigator />
      <WebFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  webPage: { flex: 1 },
  scene: { flex: 1 },
  sceneHidden: { display: "none" },
  tabIcon: { fontSize: 20 },
});
