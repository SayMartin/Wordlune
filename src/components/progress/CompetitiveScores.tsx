import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  getMyChallengeResults,
  ChallengeResult,
  updateChallengeResultVisibility,
  deleteChallengeResult,
} from "../../supabase/players-repository";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeProvider";
import Toggle from "../Toggle";
import ConfirmationOverlay from "../ConfirmationOverlay";
import OverlayMessage from "../OverlayMessage";

type ChallengeResultWithJoin = ChallengeResult & { competitive_challenges?: { name: string } | null };

export default function CompetitiveScores() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [scores, setScores] = useState<ChallengeResultWithJoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [scoreToDelete, setScoreToDelete] = useState<string | null>(null);
  const [scoreToPublish, setScoreToPublish] = useState<{ id: string; newVal: boolean } | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (profile?.id) {
      loadScores();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const loadScores = () => {
    if (!profile?.id) return;
    getMyChallengeResults(profile.id).then((data) => {
      setScores(data as ChallengeResultWithJoin[]);
      setLoading(false);
    });
  };

  const confirmPublish = async () => {
    if (!scoreToPublish) return;
    const { id, newVal } = scoreToPublish;
    setScores((prev) => prev.map((s) => (s.id === id ? { ...s, is_public: newVal } : s)));
    const { success } = await updateChallengeResultVisibility(id, newVal);
    if (!success) {
      setScores((prev) => prev.map((s) => (s.id === id ? { ...s, is_public: !newVal } : s)));
      setMessage({ text: t("error_updating_visibility", { defaultValue: "Failed to update visibility" }), type: "error" });
    } else {
      setMessage({
        text: newVal
          ? t("score_published", { defaultValue: "Score published!" })
          : t("score_unpublished", { defaultValue: "Score unpublished." }),
        type: "success",
      });
    }
    setScoreToPublish(null);
  };

  const confirmDelete = async () => {
    if (!scoreToDelete) return;
    const { success } = await deleteChallengeResult(scoreToDelete);
    if (success) {
      setScores((prev) => prev.filter((s) => s.id !== scoreToDelete));
      setMessage({ text: t("score_deleted", { defaultValue: "Score deleted" }), type: "success" });
    } else {
      setMessage({ text: t("error_deleting_score", { defaultValue: "Failed to delete score" }), type: "error" });
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
          title={t("confirm_delete_score", { defaultValue: "Delete Score?" })}
          message={t("confirm_delete_score_msg", { defaultValue: "Are you sure you want to delete this score? This cannot be undone." })}
          onConfirm={confirmDelete}
          onCancel={() => setScoreToDelete(null)}
          variant="danger"
        />
      )}
      {scoreToPublish && (
        <ConfirmationOverlay
          title={
            scoreToPublish.newVal
              ? t("publish_score", { defaultValue: "Publish Score?" })
              : t("unpublish_score", { defaultValue: "Unpublish Score?" })
          }
          message={
            scoreToPublish.newVal
              ? t("confirm_publish_msg", { defaultValue: "This score will be visible on the global leaderboard." })
              : t("confirm_unpublish_msg", { defaultValue: "This score will differ from the global leaderboard." })
          }
          onConfirm={confirmPublish}
          onCancel={() => setScoreToPublish(null)}
          confirmText={scoreToPublish.newVal ? t("publish", { defaultValue: "Publish" }) : t("unpublish", { defaultValue: "Unpublish" })}
          variant="warning"
        />
      )}

      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: "#d97706" }]}>
          🏆 {t("competitive_scores", { defaultValue: "Competitive History" })}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {t("ranked_games_description", { defaultValue: "Games that count towards the leaderboard." })}
        </Text>
      </View>

      {scores.length === 0 ? (
        <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>
          {t("no_competitive_history", { defaultValue: "No competitive games yet." })}
        </Text>
      ) : (
        scores.map((score) => (
          <View key={score.id} style={[styles.row, { borderColor: colors.border }]}>
            <Toggle checked={!!score.is_public} onChange={(v) => setScoreToPublish({ id: score.id, newVal: v })} />
            <View style={styles.rowMain}>
              <Text style={[styles.challengeName, { color: colors.text }]}>
                {score.competitive_challenges?.name || "Challenge"}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                {new Date(score.completed_at).toLocaleDateString()} · {Math.floor((score.total_duration || 0) / 60)}:
                {((score.total_duration || 0) % 60).toString().padStart(2, "0")}
              </Text>
            </View>
            <Text style={[styles.score, { color: "#d97706" }]}>{score.total_score}</Text>
            <Pressable onPress={() => setScoreToDelete(score.id)} style={styles.deleteButton}>
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
  challengeName: { fontWeight: "700" },
  score: { fontWeight: "800", fontSize: 16, fontFamily: "monospace" },
  deleteButton: { padding: 6 },
});
