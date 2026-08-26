import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { DuelLeaderboardEntry, getDuelLeaderboard } from "../supabase/matches-repository";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeProvider";
import Avatar from "./Avatar";

const MEDALS = ["🥇", "🥈", "🥉"];

/**
 * "+7", "0", "−3".
 *
 * U+2212 MINUS SIGN rather than a hyphen: at this weight a hyphen sits too high
 * and too short next to a digit, and the column is read as a signed number.
 */
const formatDiff = (diff: number) => (diff > 0 ? `+${diff}` : diff < 0 ? `−${Math.abs(diff)}` : "0");

export default function DuelLeaderboard() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session } = useAuth();
  const [entries, setEntries] = useState<DuelLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getDuelLeaderboard().then((data) => {
      setEntries(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <Text style={[styles.center, { color: colors.textMuted }]}>
        {t("no_duel_results", { defaultValue: "No duel results yet. Be the first to win!" })}
      </Text>
    );
  }

  return (
    <View style={{ gap: 8 }}>
      {entries.map((entry, idx) => {
        const isMe = session?.user?.id === entry.player_id;
        // Fall back to computing it: an older client bundle talking to a view
        // that predates the column would otherwise render "NaN".
        const diff = entry.diff ?? (entry.wins ?? 0) - (entry.losses ?? 0);
        return (
          <View
            key={entry.player_id}
            style={[
              styles.row,
              { borderColor: isMe ? colors.accent : colors.border, backgroundColor: isMe ? colors.accentSoft : colors.surface },
            ]}
          >
            <Text style={styles.rank}>{MEDALS[idx] || idx + 1}</Text>
            {/* Avatar, not a raw <Image>: avatar_url holds a
                `wordlune:avatar:<seed>` token now (see Avatar.tsx), which an
                Image can only fail to load. This component was still rendering
                it directly, so every row showed a broken image rather than the
                locally-generated avatar. */}
            <Avatar uri={entry.avatar_url} fallbackSeed={entry.display_name} size={32} />
            <Text style={[styles.name, { color: isMe ? colors.accent : colors.text }]} numberOfLines={1}>
              {entry.display_name || t("unknown", { defaultValue: "Unknown" })}
              {isMe ? ` (${t("you", { defaultValue: "You" })})` : ""}
            </Text>
            {/* The diff is what the list is sorted by, so it is what gets the
                weight; the raw record is the supporting detail underneath.
                Showing wins large while sorting by something else would make
                the order look arbitrary. */}
            <View style={styles.record}>
              <Text
                style={[
                  styles.diff,
                  { color: diff > 0 ? colors.success : diff < 0 ? colors.danger : colors.textMuted },
                ]}
              >
                {formatDiff(diff)}
              </Text>
              <Text style={[styles.recordDetail, { color: colors.textMuted }]}>
                {entry.wins}{t("wins_short", { defaultValue: "W" })} · {entry.losses ?? 0}
                {t("losses_short", { defaultValue: "L" })}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { padding: 24, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderWidth: 1, borderRadius: 10 },
  rank: { width: 24, textAlign: "center", fontWeight: "700" },
  name: { flex: 1, fontWeight: "700" },
  record: { alignItems: "flex-end" },
  diff: { fontWeight: "800", fontSize: 16, fontFamily: "monospace" },
  recordDetail: { fontSize: 11, fontFamily: "monospace" },
});
