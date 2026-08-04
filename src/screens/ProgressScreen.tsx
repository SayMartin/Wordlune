import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import JustPlayingScores from "../components/progress/JustPlayingScores";
import CompetitiveScores from "../components/progress/CompetitiveScores";
import LeaderboardScores from "../components/progress/LeaderboardScores";

type Tab = "practice" | "competitive" | "leaderboard";

const TABS: { key: Tab; labelKey: string; fallback: string; color: string }[] = [
  { key: "practice", labelKey: "start_practicing", fallback: "Practice", color: "#16a34a" },
  { key: "competitive", labelKey: "competitive", fallback: "Competitive", color: "#d97706" },
  { key: "leaderboard", labelKey: "leaderboard", fallback: "Leaderboard", color: "#2563eb" },
];

export default function ProgressScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("practice");

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t("progress", { defaultValue: "Progress" })}</Text>

      <View style={[styles.tabBar, { borderColor: colors.border }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable key={tab.key} style={styles.tabButton} onPress={() => setActiveTab(tab.key)}>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? tab.color : colors.textMuted, fontWeight: isActive ? "700" : "500" },
                ]}
              >
                {t(tab.labelKey, { defaultValue: tab.fallback })}
              </Text>
              {isActive && <View style={[styles.tabUnderline, { backgroundColor: tab.color }]} />}
            </Pressable>
          );
        })}
      </View>

      {activeTab === "practice" && <JustPlayingScores />}
      {activeTab === "competitive" && <CompetitiveScores />}
      {activeTab === "leaderboard" && <LeaderboardScores />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  title: { fontSize: 24, fontWeight: "800", textAlign: "center" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabButton: { flex: 1, alignItems: "center", paddingBottom: 10 },
  tabLabel: { fontSize: 13 },
  tabUnderline: { height: 2, width: "80%", marginTop: 8, borderRadius: 1 },
});
