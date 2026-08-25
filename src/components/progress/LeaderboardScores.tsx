import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { getGlobalLeaderboard, LeaderboardEntry } from "../../supabase/players-repository";
import { useTheme } from "../../theme/ThemeProvider";
import Card from "../ui/Card";
import Avatar from "../Avatar";

export default function LeaderboardScores() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [scores, setScores] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGlobalLeaderboard(20).then((data) => {
      setScores(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <Text style={{ color: colors.textMuted, textAlign: "center", padding: 16 }}>Loading leaderboard...</Text>;
  }

  return (
    <Card style={styles.card}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.accent }]}>
          🌍 {t("global_leaderboard", { defaultValue: "Global Leaderboard" })}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {t("top_players_public", { defaultValue: "Top players with public profiles." })}
        </Text>
      </View>

      {scores.length === 0 ? (
        <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>
          {t("no_scores_yet", { defaultValue: "No high scores yet. Be the first!" })}
        </Text>
      ) : (
        scores.map((entry, index) => (
          <View key={`${entry.player_id}-${index}`} style={[styles.row, { borderColor: colors.border }]}>
            <Text style={[styles.rank, { color: colors.textMuted }]}>{index + 1}</Text>
            <Avatar uri={entry.avatar_url} fallbackSeed={entry.display_name} size={32} />
            <View style={styles.rowMain}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {entry.display_name}
              </Text>
              {entry.challenge_name && (
                <Text style={{ color: colors.textMuted, fontSize: 11 }}>{entry.challenge_name}</Text>
              )}
            </View>
            <View style={styles.rowEnd}>
              <Text style={[styles.score, { color: colors.accent }]}>{entry.score}</Text>
              {entry.completed_at && (
                <Text style={[styles.date, { color: colors.textMuted }]}>
                  {new Date(entry.completed_at).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden" },
  header: { padding: 14, borderBottomWidth: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700", marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, gap: 10 },
  rank: { width: 20, textAlign: "center", fontWeight: "700" },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  rowMain: { flex: 1 },
  name: { fontWeight: "600" },
  rowEnd: { alignItems: "flex-end" },
  score: { fontWeight: "800" },
  date: { fontSize: 10, marginTop: 2 },
});
