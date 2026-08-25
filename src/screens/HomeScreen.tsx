import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import PageScrollView from "../components/PageScrollView";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { PageTitle, SectionHeading } from "../components/ui/Heading";
import type { AppParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<AppParamList>;

const FEATURES = [
  { emoji: "☕", titleKey: "practice_mode", titleFallback: "Relax & Practice", descKey: "practice_desc", descFallback: "Hone your skills at your own pace. No timers, no pressure—just you and the words." },
  { emoji: "🏆", titleKey: "competitive_mode", titleFallback: "Climb the Ranks", descKey: "competitive_desc", descFallback: "Ready for the big leagues? Compete in ranked challenges and secure your spot on the leaderboard." },
  { emoji: "⚔️", titleKey: "duel_lobby_title", titleFallback: "Duel Mode", descKey: "duel_description", descFallback: "Face off against another player in real-time. Be the first to solve the word!" },
  { emoji: "🌍", titleKey: "multilingual", titleFallback: "Global & Local", descKey: "multilingual_desc", descFallback: "Play in English, Swedish, or French. Improve your vocabulary in multiple languages while having fun." },
] as const;

// The width below which the feature grid collapses to one column. Same figure
// as appfinningar.se's `.card-grid` minimum track (19rem plus the gap), just
// resolved here instead of by `auto-fit`, which RN's layout engine has no
// equivalent for.
const TWO_COLUMN_MIN_WIDTH = 660;

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<Nav>();
  const { width } = useWindowDimensions();
  const twoColumns = width >= TWO_COLUMN_MIN_WIDTH;

  return (
    <PageScrollView contentContainerStyle={styles.container}>
      {/* The hero used to be a solid indigo block, which fought the page it sat
          on. It's the same glass surface as everything else now — the gradient
          behind the app is doing the colour work. */}
      <Card style={styles.hero}>
        <View style={[styles.badge, { borderColor: colors.borderHover, backgroundColor: colors.accentSoft }]}>
          <View style={[styles.badgeDot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.badgeText, { color: colors.accent }]}>
            {t("free_to_play", { defaultValue: "Free to play" })}
          </Text>
        </View>

        <PageTitle>{t("welcome_title", { defaultValue: "Master the Art of Words" })}</PageTitle>

        <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
          {t("welcome_subtitle", {
            defaultValue:
              "Embark on a linguistic journey where every guess brings you closer to mastery. Challenge yourself, compete with friends, and expand your vocabulary today.",
          })}
        </Text>

        <View style={styles.heroActions}>
          <Button
            label={`${t("play_now", { defaultValue: "Start Playing" })} →`}
            onPress={() => navigation.navigate("Game", undefined)}
          />
          <Button
            variant="ghost"
            icon="⚔️"
            label={t("duel_mode", { defaultValue: "Challenge to a Duel (PvP)" })}
            onPress={() => navigation.navigate("Game", { mode: "duel" })}
          />
          {!isAuthenticated && (
            <Button
              variant="ghost"
              label={t("signup", { defaultValue: "Sign Up" })}
              onPress={() => navigation.navigate("Signup")}
            />
          )}
        </View>
      </Card>

      <SectionHeading>{t("home_modes_heading", { defaultValue: "Ways to play" })}</SectionHeading>

      <View style={styles.features}>
        {FEATURES.map((feature) => (
          <Card
            key={feature.titleKey}
            style={[styles.featureCard, twoColumns && styles.featureCardHalf]}
          >
            <Text style={styles.featureEmoji}>{feature.emoji}</Text>
            <Text style={[styles.featureTitle, { color: colors.text }]}>
              {t(feature.titleKey, { defaultValue: feature.titleFallback })}
            </Text>
            <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
              {t(feature.descKey, { defaultValue: feature.descFallback })}
            </Text>
          </Card>
        ))}
      </View>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 8, paddingBottom: 40 },
  hero: { padding: 28, gap: 18, alignItems: "center" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 13, fontWeight: "500" },
  heroSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 23,
    // The measure stays readable on a wide desktop window — the yardstick is
    // the text, not the viewport.
    maxWidth: 520,
  },
  heroActions: { gap: 12, alignSelf: "stretch", alignItems: "center", marginTop: 4 },
  features: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  featureCard: { flexGrow: 1, flexBasis: "100%", padding: 22, alignItems: "center", gap: 10 },
  // flexBasis just under half leaves room for the 16px gap without needing a
  // percentage that resolves differently across the two layout engines.
  featureCardHalf: { flexBasis: "45%" },
  featureEmoji: { fontSize: 32 },
  featureTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  featureDesc: { fontSize: 14, textAlign: "center", lineHeight: 21 },
});
