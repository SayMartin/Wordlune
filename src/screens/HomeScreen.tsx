import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import type { AppParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<AppParamList>;

const FEATURES = [
  { emoji: "☕", titleKey: "practice_mode", titleFallback: "Relax & Practice", descKey: "practice_desc", descFallback: "Hone your skills at your own pace. No timers, no pressure—just you and the words." },
  { emoji: "🏆", titleKey: "competitive_mode", titleFallback: "Climb the Ranks", descKey: "competitive_desc", descFallback: "Ready for the big leagues? Compete in ranked challenges and secure your spot on the leaderboard." },
  { emoji: "⚔️", titleKey: "duel_lobby_title", titleFallback: "Duel Mode", descKey: "duel_description", descFallback: "Face off against another player in real-time. Be the first to solve the word!" },
  { emoji: "🌍", titleKey: "multilingual", titleFallback: "Global & Local", descKey: "multilingual_desc", descFallback: "Play in English, Swedish, or French. Improve your vocabulary in multiple languages while having fun." },
] as const;

export default function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<Nav>();

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>
          {t("welcome_title", { defaultValue: "Master the Art of Words" })}
        </Text>
        <Text style={styles.heroSubtitle}>
          {t("welcome_subtitle", {
            defaultValue:
              "Embark on a linguistic journey where every guess brings you closer to mastery. Challenge yourself, compete with friends, and expand your vocabulary today.",
          })}
        </Text>

        <View style={styles.heroActions}>
          <Pressable
            style={[styles.button, styles.primaryButton]}
            onPress={() => navigation.navigate("Game", undefined)}
          >
            <Text style={styles.primaryButtonText}>
              {t("play_now", { defaultValue: "Start Playing" })} →
            </Text>
          </Pressable>

          <Pressable
            style={[styles.button, styles.duelButton]}
            onPress={() => navigation.navigate("Game", { mode: "duel" })}
          >
            <Text style={styles.duelButtonText}>
              {t("duel_mode", { defaultValue: "Challenge to a Duel (PvP)" })}
            </Text>
          </Pressable>

          {!isAuthenticated && (
            <Pressable
              style={[styles.button, styles.outlineButton]}
              onPress={() => navigation.navigate("Signup")}
            >
              <Text style={styles.outlineButtonText}>
                {t("signup", { defaultValue: "Sign Up" })}
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.features}>
        {FEATURES.map((feature) => (
          <View
            key={feature.titleKey}
            style={[
              styles.featureCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={styles.featureEmoji}>{feature.emoji}</Text>
            <Text style={[styles.featureTitle, { color: colors.text }]}>
              {t(feature.titleKey, { defaultValue: feature.titleFallback })}
            </Text>
            <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
              {t(feature.descKey, { defaultValue: feature.descFallback })}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 24 },
  hero: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: "#4338ca",
    gap: 16,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
  },
  heroSubtitle: {
    fontSize: 15,
    color: "#e0e7ff",
    textAlign: "center",
    lineHeight: 22,
  },
  heroActions: { gap: 12 },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 999,
    alignItems: "center",
  },
  primaryButton: { backgroundColor: "#e5e7eb" },
  primaryButtonText: { color: "#4338ca", fontWeight: "700", fontSize: 15 },
  duelButton: { backgroundColor: "#ea580c" },
  duelButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  outlineButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  features: { gap: 16 },
  featureCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  featureEmoji: { fontSize: 32 },
  featureTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  featureDesc: { fontSize: 14, textAlign: "center", lineHeight: 20 },
});
