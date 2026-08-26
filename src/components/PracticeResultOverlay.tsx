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
  onClose: () => void;
  isSaved?: boolean;
}

export default function PracticeResultOverlay({
  status,
  secret,
  guessesCount,
  breakdown,
  durationSeconds,
  onClose,
  isSaved,
}: Props) {
  const { t } = useTranslation();
  const { colors, radii } = useTheme();
  const isWon = status === "won";
  const timeString = formatDuration(durationSeconds);
  // Collapsed by default: the three stat cells answer "what did I get", and the
  // arithmetic answers "why", which most players only want once. Expanded
  // inline rather than in a second Modal — nesting Modals is unreliable on iOS
  // and this overlay is already the modal the breakdown belongs in.
  const [showMath, setShowMath] = useState(false);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Opaque, not the glass surface — a modal you can see the board
            through reads as a bug rather than as depth. */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceSolid,
              borderColor: isWon ? colors.success : colors.border,
              borderRadius: radii.lg,
            },
          ]}
        >
          <Text style={styles.emoji}>{isWon ? "🏆" : "🐌"}</Text>
          <Text style={[styles.title, { color: isWon ? colors.success : colors.text }]}>
            {isWon ? t("you_won", { defaultValue: "You Won!" }) : t("game_over", { defaultValue: "Game Over" })}
          </Text>
          <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
            {isWon ? t("great_job", { defaultValue: "Great job!" }) : t("better_luck", { defaultValue: "Better luck next time!" })}
          </Text>

          <Text style={[styles.wordLabel, { color: colors.textMuted }]}>
            {t("correct_word", { defaultValue: "Correct Word" })}
          </Text>
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

          {isSaved && (
            <Text style={[styles.saved, { color: colors.success }]}>
              ✓ {t("score_saved", { defaultValue: "Score saved" })}
            </Text>
          )}

          <Pressable
            style={[styles.button, { backgroundColor: isWon ? colors.success : colors.surfaceHover }]}
            onPress={onClose}
          >
            <Text style={[styles.buttonText, { color: isWon ? colors.onAccent : colors.text }]}>
              {t("ok", { defaultValue: "OK" })}
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
  emoji: { fontSize: 44, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "900" },
  wordLabel: { fontSize: 11, textTransform: "uppercase", marginTop: 8 },
  word: { fontSize: 20, fontWeight: "800", textTransform: "uppercase", marginBottom: 8, letterSpacing: 1 },
  statsRow: { flexDirection: "row", gap: 8, width: "100%", marginTop: 4 },
  statCell: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(148,163,184,0.15)" },
  // rgba grey works on both themes here: it darkens a light card and lightens
  // a dark one, which is exactly what a stat well wants to do.
  statLabel: { fontSize: 10, textTransform: "uppercase", fontWeight: "700" },
  statValue: { fontSize: 16, fontWeight: "800" },
  mathToggle: { marginTop: 12 },
  mathToggleText: { fontSize: 12, fontWeight: "700", textDecorationLine: "underline" },
  mathScroll: { width: "100%", marginTop: 10 },
  mathContent: { gap: 12 },
  rulesDivider: { borderTopWidth: 1, paddingTop: 10 },
  saved: { fontWeight: "600", marginTop: 8 },
  button: { width: "100%", paddingVertical: 12, borderRadius: 999, alignItems: "center", marginTop: 16 },
  buttonText: { fontWeight: "700" },
});
