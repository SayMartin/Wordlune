import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { DuelLeaderboardEntry, getDuelLeaderboard } from "../supabase/matches-repository";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeProvider";

const MEDALS = ["🥇", "🥈", "🥉"];

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
        return (
          <View
            key={entry.player_id}
            style={[
              styles.row,
              { borderColor: colors.border, backgroundColor: isMe ? "#eef2ff" : colors.surface },
            ]}
          >
            <Text style={styles.rank}>{MEDALS[idx] || idx + 1}</Text>
            {entry.avatar_url ? (
              <Image source={{ uri: entry.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarFallbackText}>{entry.display_name?.substring(0, 2).toUpperCase() || "??"}</Text>
              </View>
            )}
            <Text style={[styles.name, { color: isMe ? "#4338ca" : colors.text }]} numberOfLines={1}>
              {entry.display_name || "Unknown"}
              {isMe ? ` (${t("you", { defaultValue: "You" })})` : ""}
            </Text>
            <Text style={styles.wins}>
              {entry.wins} <Text style={styles.winsLabel}>{t("wins", { defaultValue: "wins" })}</Text>
            </Text>
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
  avatar: { width: 32, height: 32, borderRadius: 16 },
  avatarFallback: { backgroundColor: "#e2e8f0", alignItems: "center", justifyContent: "center" },
  avatarFallbackText: { fontSize: 10, fontWeight: "700", color: "#64748b" },
  name: { flex: 1, fontWeight: "700" },
  wins: { fontWeight: "800", color: "#4f46e5", fontFamily: "monospace" },
  winsLabel: { fontWeight: "400", fontSize: 11, color: "#94a3b8" },
});
