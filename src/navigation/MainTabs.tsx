import React from "react";
import { Text } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useTranslation } from "react-i18next";
import HomeScreen from "../screens/HomeScreen";
import GameScreen from "../screens/GameScreen";
import ProgressScreen from "../screens/ProgressScreen";
import ProfileScreen from "../screens/ProfileScreen";
import AboutScreen from "../screens/AboutScreen";
import HeaderRight from "../components/HeaderRight";
import { useTheme } from "../theme/ThemeProvider";
import type { MainTabParamList } from "./types";

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, string> = {
  Home: "🏠",
  Game: "🎮",
  Progress: "📈",
  Profile: "👤",
  About: "ℹ️",
};

export default function MainTabs() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: t("home", { defaultValue: "Home" }) }} />
      <Tab.Screen name="Game" component={GameScreen} options={{ title: t("game", { defaultValue: "Game" }) }} />
      <Tab.Screen name="Progress" component={ProgressScreen} options={{ title: t("progress", { defaultValue: "Progress" }) }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t("my_profile", { defaultValue: "Profile" }) }} />
      <Tab.Screen name="About" component={AboutScreen} options={{ title: t("about", { defaultValue: "About" }) }} />
    </Tab.Navigator>
  );
}
