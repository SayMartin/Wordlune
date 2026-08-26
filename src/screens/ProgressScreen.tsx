import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import PageScrollView from "../components/PageScrollView";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { PageTitle } from "../components/ui/Heading";
import Card from "../components/ui/Card";
import JustPlayingScores from "../components/progress/JustPlayingScores";
import CompetitiveScores from "../components/progress/CompetitiveScores";
import LeaderboardScores from "../components/progress/LeaderboardScores";
import DuelHistory from "../components/progress/DuelHistory";
import DuelLeaderboard from "../components/DuelLeaderboard";
import TwoColumn from "../components/progress/TwoColumn";

type Tab = "practice" | "competitive" | "duel";

// One tab per game mode, matching GameModeToggle's order and icons, rather
// than the old practice/competitive/leaderboard split — which put duels
// nowhere and made "leaderboard" a mode of its own even though two of the
// three modes have one. Each mode now owns both halves of its own story.
//
// Each tab used to carry its own fixed colour (green/amber/blue). They now
// share the accent: three competing hues on one tab strip said nothing the
// labels didn't already say, and none of the three survived a theme switch.
const TABS: { key: Tab; labelKey: string; fallback: string; icon: string }[] = [
  { key: "practice", labelKey: "start_practicing", fallback: "Practice", icon: "☕" },
  { key: "competitive", labelKey: "competitive", fallback: "Competitive", icon: "🏆" },
  { key: "duel", labelKey: "duel", fallback: "Duel", icon: "⚔️" },
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
                {tab.icon} {t(tab.labelKey, { defaultValue: tab.fallback })}
              </Text>
              {isActive && <View style={[styles.tabUnderline, { backgroundColor: colors.accent }]} />}
            </Pressable>
          );
        })}
      </View>

      {/* Practice has no second column and never will: a practice round is
          played against a word list of your own choosing, so there is nothing
          to rank it against and nothing to publish. Saying so outright is
          better than leaving an empty column where the public list sits in the
          other two tabs. */}
      {activeTab === "practice" && (
        <View style={styles.singleColumn}>
          <View style={styles.heading}>
            <Text style={[styles.headingText, { color: colors.text }]}>
              🔒 {t("private_history", { defaultValue: "Your history" })}
            </Text>
            <Text style={[styles.headingHint, { color: colors.textMuted }]}>
              {t("practice_always_private", {
                defaultValue:
                  "Practice is always private. These rounds are never published and never appear on any leaderboard.",
              })}
            </Text>
          </View>
          <JustPlayingScores />
        </View>
      )}

      {activeTab === "competitive" && (
        <TwoColumn
          privateLabel={t("private_history", { defaultValue: "Your history" })}
          privateHint={t("competitive_private_hint", {
            defaultValue: "Only you can see these. Use the toggle to publish a result to the list beside it.",
          })}
          publicLabel={t("global_leaderboard", { defaultValue: "Global Leaderboard" })}
          publicHint={t("competitive_public_hint", {
            defaultValue: "Published results only, and only each player's first run of a challenge.",
          })}
          privateContent={<CompetitiveScores />}
          publicContent={<LeaderboardScores />}
        />
      )}

      {/* No per-duel publish toggle, deliberately: a duel is two people's row,
          so one of them can't decide to publish it. The public side is the
          win/loss tally, gated on the profile-level is_public in Settings. */}
      {activeTab === "duel" && (
        <TwoColumn
          privateLabel={t("private_history", { defaultValue: "Your history" })}
          privateHint={t("duel_private_hint", {
            defaultValue: "Only you can see these. Individual duels are never published.",
          })}
          publicLabel={t("duel_leaderboard", { defaultValue: "Duel Leaderboard" })}
          publicHint={t("duel_public_hint", {
            defaultValue:
              "Ranked by difference — wins minus losses. Players with a public profile only; set yours in Settings.",
          })}
          privateContent={<DuelHistory />}
          publicContent={
            <Card style={styles.duelBoardCard}>
              <DuelLeaderboard />
            </Card>
          }
        />
      )}
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
  singleColumn: { gap: 8 },
  heading: { gap: 2, paddingHorizontal: 2 },
  headingText: { fontSize: 14, fontWeight: "800" },
  headingHint: { fontSize: 11, lineHeight: 15 },
  // DuelLeaderboard renders bare rows (it also lives inside DuelLobby, which
  // supplies its own surface), so it needs a card of its own here to sit level
  // with the carded history beside it.
  duelBoardCard: { padding: 12 },
});
