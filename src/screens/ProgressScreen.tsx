import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import PageScrollView from "../components/PageScrollView";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { PageTitle } from "../components/ui/Heading";
import JustPlayingScores from "../components/progress/JustPlayingScores";
import CompetitiveScores from "../components/progress/CompetitiveScores";
import LeaderboardScores from "../components/progress/LeaderboardScores";

type Tab = "practice" | "competitive" | "leaderboard";

// Each tab used to carry its own fixed colour (green/amber/blue). They now
// share the accent: three competing hues on one tab strip said nothing the
// labels didn't already say, and none of the three survived a theme switch.
const TABS: { key: Tab; labelKey: string; fallback: string }[] = [
  { key: "practice", labelKey: "start_practicing", fallback: "Practice" },
  { key: "competitive", labelKey: "competitive", fallback: "Competitive" },
  { key: "leaderboard", labelKey: "leaderboard", fallback: "Leaderboard" },
];

export default function ProgressScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("practice");

  return (
    <PageScrollView contentContainerStyle={styles.container}>
      <View style={styles.titleRow}>
        <PageTitle>{t("progress", { defaultValue: "Progress" })}</PageTitle>
      </View>

      <View style={[styles.tabBar, { borderColor: colors.border }]}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable key={tab.key} style={styles.tabButton} onPress={() => setActiveTab(tab.key)}>
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.text : colors.textMuted, fontWeight: isActive ? "700" : "500" },
                ]}
              >
                {t(tab.labelKey, { defaultValue: tab.fallback })}
              </Text>
              {isActive && <View style={[styles.tabUnderline, { backgroundColor: colors.accent }]} />}
            </Pressable>
          );
        })}
      </View>

      {activeTab === "practice" && <JustPlayingScores />}
      {activeTab === "competitive" && <CompetitiveScores />}
      {activeTab === "leaderboard" && <LeaderboardScores />}
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  titleRow: { alignItems: "center" },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabButton: { flex: 1, alignItems: "center", paddingBottom: 10 },
  tabLabel: { fontSize: 13 },
  tabUnderline: { height: 2, width: "80%", marginTop: 8, borderRadius: 1 },
});
