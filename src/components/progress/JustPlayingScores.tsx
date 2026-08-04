import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getMyScores, GameScore, deleteGameScores } from "../../supabase/players-repository";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeProvider";
import ConfirmationOverlay from "../ConfirmationOverlay";
import OverlayMessage from "../OverlayMessage";

export default function JustPlayingScores() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreToDelete, setScoreToDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (profile?.id) {
      getMyScores(profile.id, { mode: "practice" }).then((data) => {
        setScores(data);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [profile]);

  const confirmDelete = async () => {
    if (!scoreToDelete) return;
    const res = await deleteGameScores([scoreToDelete]);
    if (res.success) {
      setScores((prev) => prev.filter((s) => s.id !== scoreToDelete));
      setMessage({ text: t("score_deleted", { defaultValue: "Score deleted" }), type: "success" });
    } else {
      setMessage({ text: t("error_delete_scores", { defaultValue: "Failed to delete scores" }), type: "error" });
    }
    setScoreToDelete(null);
  };

  if (loading) {
    return <Text style={{ color: colors.textMuted, textAlign: "center", padding: 16 }}>{t("loading_scores", { defaultValue: "Loading scores..." })}</Text>;
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {message && (
        <OverlayMessage message={message.text} type={message.type} onClose={() => setMessage(null)} duration={3000} />
      )}
      {scoreToDelete && (
        <ConfirmationOverlay
          title={t("delete_scores_title", { defaultValue: "Delete Score?" })}
          message={t("confirm_delete_score_msg", { defaultValue: "Are you sure you want to delete this score? This cannot be undone." })}
          onConfirm={confirmDelete}
          onCancel={() => setScoreToDelete(null)}
          confirmText={t("delete", { defaultValue: "Delete" })}
          variant="danger"
        />
      )}

      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          ☕ {t("just_playing_scores", { defaultValue: "Practice History" })}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {t("private_practice_games", { defaultValue: "Your private practice games." })}
        </Text>
      </View>

      {scores.length === 0 ? (
        <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>
          {t("no_games_played", { defaultValue: "No games played yet. Go practice!" })}
        </Text>
      ) : (
        scores.map((score) => (
          <View key={score.id} style={[styles.row, { borderColor: colors.border }]}>
            <View style={styles.rowMain}>
              <Text style={[styles.word, { color: "#4f46e5" }]}>{score.word}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {score.guesses_count} {t("guesses", { defaultValue: "guesses" })} · {score.duration_seconds ?? 0}s
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                {score.completed_at ? new Date(score.completed_at).toLocaleDateString() : ""}
              </Text>
            </View>
            <Text style={[styles.score, { color: colors.text }]}>{score.score}</Text>
            <Pressable onPress={() => setScoreToDelete(score.id!)} style={styles.deleteButton}>
              <Text>🗑️</Text>
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  header: { padding: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, gap: 10 },
  rowMain: { flex: 1, gap: 2 },
  word: { fontWeight: "700", fontFamily: "monospace" },
  score: { fontWeight: "800", fontSize: 16, minWidth: 32, textAlign: "right" },
  deleteButton: { padding: 6 },
});
