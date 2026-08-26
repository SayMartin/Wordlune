import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { DuelHistoryEntry, getMyDuelHistory } from "../../supabase/matches-repository";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme/ThemeProvider";
import Card from "../ui/Card";
import { flagFor } from "../../utils/languageCycle";

/**
 * The player's own finished duels: when, against whom, and the final score.
 *
 * Private and unpublishable by design. Unlike a challenge result there is no
 * per-duel visibility flag to offer — a duel is two people's row, so one of
 * them cannot decide to publish it. What reaches the public duel list is the
 * win/loss tally only, gated on the profile-level `is_public`.
 */
export default function DuelHistory() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [entries, setEntries] = useState<DuelHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }
    getMyDuelHistory().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, [profile]);

  if (loading) {
    return (
      <Text style={[styles.center, { color: colors.textMuted }]}>
        {t("loading_scores", { defaultValue: "Loading scores..." })}
      </Text>
    );
  }

  return (
    <Card style={styles.card}>
      {entries.length === 0 ? (
        <Text style={[styles.center, { color: colors.textMuted }]}>
          {t("no_duels_played", { defaultValue: "No duels played yet." })}
        </Text>
      ) : (
        entries.map((entry) => (
          <View key={entry.id} style={[styles.row, { borderColor: colors.border }]}>
            <Text style={styles.outcome}>{entry.won ? "🏆" : "🥈"}</Text>

            <View style={styles.rowMain}>
              <Text style={[styles.opponent, { color: colors.text }]} numberOfLines={1}>
                {entry.opponent_name || t("unknown", { defaultValue: "Unknown" })}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                {new Date(entry.finished_at || entry.created_at).toLocaleDateString()}
                {entry.language ? ` · ${flagFor(entry.language)}` : ""}
              </Text>
            </View>

            {/* NULL for duels finished before scores were persisted
                (20260827). Showing "0 – 0" for those would invent a result
                that never existed, so they show a dash instead. */}
            {entry.my_score === null && entry.opponent_score === null ? (
              <Text style={[styles.noScore, { color: colors.textMuted }]}>—</Text>
            ) : (
              <Text style={[styles.score, { color: entry.won ? colors.success : colors.textMuted }]}>
                {entry.my_score ?? 0}
                <Text style={{ color: colors.textMuted }}> – </Text>
                {entry.opponent_score ?? 0}
              </Text>
            )}
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden" },
  center: { padding: 24, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, gap: 10 },
  outcome: { fontSize: 18 },
  rowMain: { flex: 1, gap: 2 },
  opponent: { fontWeight: "700" },
  score: { fontWeight: "800", fontSize: 15, fontFamily: "monospace" },
  noScore: { fontSize: 15 },
});
