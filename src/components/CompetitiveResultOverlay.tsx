import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { WordScoreMath, ScoringRules } from "./ScoreBreakdown";
import { ScoreBreakdown, formatDuration } from "../utils/scoring";

interface Props {
  status: "won" | "lost";
  secret: string;
  guessesCount: number;
  breakdown: ScoreBreakdown;
  durationSeconds: number;
  onNext: () => void;
  isLastWord: boolean;
  isForfeit?: boolean;
}

export default function CompetitiveResultOverlay({
  status,
  secret,
  guessesCount,
  breakdown,
  durationSeconds,
  onNext,
  isLastWord,
  isForfeit,
}: Props) {
  const { t } = useTranslation();
  const { colors, radii } = useTheme();
  const isWon = status === "won";
  // See PracticeResultOverlay: inline rather than a nested Modal.
  const [showMath, setShowMath] = useState(false);

  let title = "";
  let message = "";
  let icon = "";
  let accent = colors.text;

  if (isForfeit) {
    title = t("challenge_forfeited", { defaultValue: "Challenge Forfeited" });
    message = t("challenge_forfeited_msg", { defaultValue: "You gave up. Better luck next time!" });
    icon = "🏳️";
    accent = colors.textMuted;
  } else if (isWon) {
    if (isLastWord) {
      title = t("challenge_completed", { defaultValue: "Challenge Completed!" });
      message = t("challenge_completed_msg", { defaultValue: "Great job! You finished the challenge." });
      icon = "🏆";
    } else {
      title = t("word_solved", { defaultValue: "Word Solved!" });
      message = t("word_solved_msg", { defaultValue: "Congratulations on one word correctly set" });
      icon = "⭐";
    }
    accent = colors.success;
  } else {
    if (isLastWord) {
      title = t("game_over", { defaultValue: "Game Over" });
      message = t("better_luck", { defaultValue: "Better luck next time!" });
      icon = "🐌";
      accent = colors.text;
    } else {
      title = t("word_missed", { defaultValue: "Word Missed" });
      message = t("keep_going", { defaultValue: "Keep going! The next word awaits." });
      icon = "💪";
      accent = colors.warning;
    }
  }

  const timeString = formatDuration(durationSeconds);

  const buttonLabel = isForfeit
    ? t("back_to_practice", { defaultValue: "Back to Practice ↩️" })
    : isLastWord
      ? t("finish_challenge", { defaultValue: "Finish Challenge 🏆" })
      : t("next_word", { defaultValue: "Next Challenge Word ➡️" });

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onNext}>
      <View style={styles.backdrop}>
        {/* Opaque, not the glass surface — see PracticeResultOverlay. */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceSolid, borderColor: accent, borderRadius: radii.lg },
          ]}
        >
          <Text style={styles.icon}>{icon}</Text>
          <Text style={[styles.title, { color: accent }]}>{title}</Text>
          <Text style={{ color: colors.textMuted, marginBottom: 8, textAlign: "center" }}>{message}</Text>

          <Text style={[styles.wordLabel, { color: colors.textMuted }]}>{t("correct_word", { defaultValue: "Correct Word" })}</Text>
          <Text style={[styles.word, { color: isWon ? colors.text : colors.danger }]}>{secret}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("guesses", { defaultValue: "Guesses" })}</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{guessesCount}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("points", { defaultValue: "Points" })}</Text>
              <Text style={[styles.statValue, { color: colors.warning }]}>{breakdown.total}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("time", { defaultValue: "Time" })}</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{timeString}</Text>
            </View>
          </View>

          <Pressable onPress={() => setShowMath((v) => !v)} style={styles.mathToggle}>
            <Text style={[styles.mathToggleText, { color: colors.accent }]}>
              {t("score_how_calculated", { defaultValue: "How was this calculated?" })} {showMath ? "▾" : "▸"}
            </Text>
          </Pressable>

          {showMath && (
            <ScrollView style={styles.mathScroll} contentContainerStyle={styles.mathContent}>
              <WordScoreMath breakdown={breakdown} />
              <View style={[styles.rulesDivider, { borderTopColor: colors.border }]}>
                <ScoringRules compact />
              </View>
            </ScrollView>
          )}

          <Pressable
            style={[styles.button, { backgroundColor: isWon ? colors.success : colors.surfaceHover }]}
            onPress={onNext}
          >
            <Text style={[styles.buttonText, { color: isWon ? colors.onAccent : colors.text }]}>
              {buttonLabel}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 360, maxHeight: "90%", borderWidth: 1, padding: 24, alignItems: "center", gap: 4 },
  icon: { fontSize: 44, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "900" },
  wordLabel: { fontSize: 11, textTransform: "uppercase", marginTop: 8 },
  word: { fontSize: 20, fontWeight: "800", textTransform: "uppercase", marginBottom: 8, letterSpacing: 1 },
  statsRow: { flexDirection: "row", gap: 8, width: "100%", marginTop: 4 },
  statCell: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(148,163,184,0.15)" },
  statLabel: { fontSize: 10, textTransform: "uppercase", fontWeight: "700" },
  statValue: { fontSize: 16, fontWeight: "800" },
  mathToggle: { marginTop: 12 },
  mathToggleText: { fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  mathScroll: { width: "100%", marginTop: 10 },
  mathContent: { gap: 12 },
  rulesDivider: { borderTopWidth: 1, paddingTop: 10 },
  button: { width: "100%", paddingVertical: 12, borderRadius: 999, alignItems: "center", marginTop: 16 },
  buttonText: { fontWeight: "700" },
});
