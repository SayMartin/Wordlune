import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { Match } from "../supabase/matches-repository";
import { useTheme } from "../theme/ThemeProvider";

const ADJECTIVES = ["Brave", "Calm", "Cyber", "Eager", "Fair", "Grand", "Happy", "Jolly", "Keen", "Lucky", "Magic", "Neon", "Odd", "Proud", "Quick", "Rare", "Solar", "Tough", "Vivid", "Wild"];
const ANIMALS = ["Bear", "Cat", "Dog", "Eagle", "Fox", "Goat", "Hawk", "Ibex", "Jay", "Koala", "Lion", "Mouse", "Newt", "Owl", "Panda", "Quail", "Raven", "Shark", "Tiger", "Wolf"];

function getChallengeName(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i);
    hash |= 0;
  }
  const adjIndex = Math.abs(hash) % ADJECTIVES.length;
  const animIndex = Math.abs(hash >> 5) % ANIMALS.length;
  return `${ADJECTIVES[adjIndex]} ${ANIMALS[animIndex]}`;
}

function getMatchDisplayName(match: Match): string {
  if (match.p1_name && match.p1_name !== "Unknown") return match.p1_name;
  return getChallengeName(match.id);
}

interface Props {
  match: Match;
  onJoin: (id: string) => void;
  loading: boolean;
}

export default function DuelChallengeCard({ match, onJoin, loading }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Pressable
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, loading && styles.disabled]}
      onPress={() => onJoin(match.id)}
      disabled={loading}
    >
      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]}>{getMatchDisplayName(match)}</Text>
          <Text>{match.language === "sv" ? "🇸🇪" : "🇬🇧"}</Text>
          {match.is_hint_enabled ? <Text>💡</Text> : null}
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>
          {new Date(match.created_at).toLocaleTimeString()}
        </Text>
      </View>
      <View style={styles.joinBadge}>
        <Text style={styles.joinText}>{t("join", { defaultValue: "Join" })}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderWidth: 1,
    borderRadius: 10,
  },
  disabled: { opacity: 0.6 },
  info: { gap: 2, flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontWeight: "700" },
  joinBadge: { backgroundColor: "#dcfce7", borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  joinText: { color: "#15803d", fontWeight: "700", fontSize: 12 },
});
