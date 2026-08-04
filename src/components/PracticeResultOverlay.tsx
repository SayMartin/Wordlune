import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

interface Props {
  status: "won" | "lost";
  secret: string;
  guessesCount: number;
  score: number;
  durationSeconds: number;
  onClose: () => void;
  isSaved?: boolean;
}

export default function PracticeResultOverlay({
  status,
  secret,
  guessesCount,
  score,
  durationSeconds,
  onClose,
  isSaved,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const isWon = status === "won";
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: isWon ? "#4ade80" : colors.border },
          ]}
        >
          <Text style={styles.emoji}>{isWon ? "🏆" : "🐌"}</Text>
          <Text style={[styles.title, { color: isWon ? "#16a34a" : colors.text }]}>
            {isWon ? t("you_won", { defaultValue: "You Won!" }) : t("game_over", { defaultValue: "Game Over" })}
          </Text>
          <Text style={{ color: colors.textMuted, marginBottom: 8 }}>
            {isWon ? t("great_job", { defaultValue: "Great job!" }) : t("better_luck", { defaultValue: "Better luck next time!" })}
          </Text>

          <Text style={[styles.wordLabel, { color: colors.textMuted }]}>
            {t("correct_word", { defaultValue: "Correct Word" })}
          </Text>
          <Text style={[styles.word, { color: isWon ? colors.text : "#dc2626" }]}>{secret}</Text>

          <View style={styles.statsRow}>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("guesses", { defaultValue: "Guesses" })}</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{guessesCount}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("points", { defaultValue: "Points" })}</Text>
              <Text style={[styles.statValue, { color: "#d97706" }]}>{score}</Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("time", { defaultValue: "Time" })}</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{timeString}</Text>
            </View>
          </View>

          {isSaved && (
            <Text style={styles.saved}>✓ {t("score_saved", { defaultValue: "Score saved" })}</Text>
          )}

          <Pressable
            style={[styles.button, { backgroundColor: isWon ? "#16a34a" : "#1f2937" }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>{t("ok", { defaultValue: "OK" })}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 360, borderRadius: 20, borderWidth: 2, padding: 24, alignItems: "center", gap: 4 },
  emoji: { fontSize: 44, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: "900" },
  wordLabel: { fontSize: 11, textTransform: "uppercase", marginTop: 8 },
  word: { fontSize: 20, fontWeight: "800", textTransform: "uppercase", marginBottom: 8, letterSpacing: 1 },
  statsRow: { flexDirection: "row", gap: 8, width: "100%", marginTop: 4 },
  statCell: { flex: 1, alignItems: "center", gap: 2, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(148,163,184,0.15)" },
  statLabel: { fontSize: 10, textTransform: "uppercase", fontWeight: "700" },
  statValue: { fontSize: 16, fontWeight: "800" },
  saved: { color: "#16a34a", fontWeight: "600", marginTop: 8 },
  button: { width: "100%", paddingVertical: 12, borderRadius: 12, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#ffffff", fontWeight: "700" },
});
