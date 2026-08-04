import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { getChallengeMenu, ChallengeMetadata, ChallengeAttempt, getMyChallengeAttempts } from "../supabase/players-repository";
import ConfirmationOverlay from "./ConfirmationOverlay";

interface Props {
  onSelect: (challengeId: string, description?: any, isFiveChars?: boolean) => void;
  onCancel: () => void;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy: "#16a34a",
  Medium: "#d97706",
  Hard: "#dc2626",
};

function getLocalizedDesc(desc: any, lang: string): string | string[] {
  if (!desc) return "";
  let obj = desc;
  if (typeof desc === "string") {
    try {
      obj = JSON.parse(desc);
    } catch {
      return desc;
    }
  }
  if (typeof obj === "object" && obj !== null) {
    const code = lang.substring(0, 2);
    return obj[code] || obj.en || "";
  }
  return String(desc);
}

function renderDescription(desc: any, lang: string): string {
  let content = getLocalizedDesc(desc, lang);
  if (typeof content === "string" && content.includes(",")) {
    return content
      .split(",")
      .map((s) => s.trim())
      .join(" · ");
  }
  if (Array.isArray(content)) return content.join(" · ");
  return String(content);
}

export default function ChallengeSelector({ onSelect, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeMetadata[]>([]);
  const [attempts, setAttempts] = useState<Record<string, ChallengeAttempt>>({});
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    async function loadData() {
      const menu = await getChallengeMenu();
      setChallenges(menu);
      if (profile?.id) {
        const myAttempts = await getMyChallengeAttempts(profile.id);
        const map: Record<string, ChallengeAttempt> = {};
        myAttempts.forEach((a) => (map[a.challenge_id] = a));
        setAttempts(map);
      }
      setLoading(false);
    }
    loadData();
  }, [profile]);

  const handleSelect = (c: ChallengeMetadata) => {
    const attempt = attempts[c.id];
    if (attempt && (attempt.status === "completed" || attempt.status === "forfeited")) {
      setWarning({
        title: t("challenge_done_title", { defaultValue: "Challenge Done" }),
        message: t("challenge_done_msg", { defaultValue: "Once a challenge is done you can not replay that challenge." }),
      });
      return;
    }
    onSelect(c.id, c.description, c.is_five_chars);
  };

  if (loading) {
    return <Text style={{ color: colors.textMuted, textAlign: "center", padding: 16 }}>{t("loading_challenges", { defaultValue: "Loading challenges..." })}</Text>;
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: "#b45309" }]}>{t("select_challenge", { defaultValue: "Select a Challenge" })}</Text>
        <Pressable onPress={onCancel}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("cancel", { defaultValue: "Cancel" })}</Text>
        </Pressable>
      </View>

      {challenges.length === 0 ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ color: colors.textMuted }}>{t("no_challenges", { defaultValue: "No active challenges right now." })}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>{t("check_back_tomorrow", { defaultValue: "Check back tomorrow!" })}</Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 420 }}>
          <View style={{ gap: 10 }}>
            {challenges.map((c) => {
              const attempt = attempts[c.id];
              const isDone = attempt && (attempt.status === "completed" || attempt.status === "forfeited");
              const isForfeit = attempt?.status === "forfeited";

              return (
                <Pressable
                  key={c.id}
                  style={[
                    styles.challengeCard,
                    { borderColor: colors.border, backgroundColor: colors.background },
                    isDone && styles.doneCard,
                  ]}
                  onPress={() => handleSelect(c)}
                >
                  {isDone && <Text style={styles.doneBadge}>{isForfeit ? "🏳️" : "✅"}</Text>}
                  <View style={styles.titleRow}>
                    <Text style={[styles.challengeName, { color: colors.text }]}>{c.name}</Text>
                    {c.is_five_chars && (
                      <View style={styles.fiveBadge}>
                        <Text style={styles.fiveBadgeText}>5x5</Text>
                      </View>
                    )}
                  </View>
                  {c.description && (
                    <Text style={styles.description} numberOfLines={2}>
                      {renderDescription(c.description, i18n.language)}
                    </Text>
                  )}
                  <View style={styles.footerRow}>
                    <Text style={{ color: DIFFICULTY_COLORS[c.difficulty] || colors.textMuted, fontWeight: "700", fontSize: 11 }}>
                      {c.difficulty}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      👥 {c.completions_count || 0} {t("completed", { defaultValue: "completed" })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {warning && (
        <ConfirmationOverlay
          title={warning.title}
          message={warning.message}
          onConfirm={() => setWarning(null)}
          confirmText={t("ok", { defaultValue: "OK" })}
          variant="info"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, paddingBottom: 10 },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  challengeCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4, position: "relative" },
  doneCard: { opacity: 0.7 },
  doneBadge: { position: "absolute", top: 8, right: 10, fontSize: 16 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  challengeName: { fontWeight: "700", fontSize: 14 },
  fiveBadge: { backgroundColor: "#dcfce7", borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  fiveBadgeText: { color: "#15803d", fontSize: 9, fontWeight: "800" },
  description: { color: "#6366f1", fontSize: 11 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
});
