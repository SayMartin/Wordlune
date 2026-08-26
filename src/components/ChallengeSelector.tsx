import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import Card from "./ui/Card";
import { useAuth } from "../context/AuthContext";
import {
  getChallengeMenu,
  challengeCategoryNames,
  ChallengeMetadata,
  ChallengeAttempt,
  getMyChallengeAttempts,
  restartChallengeAttempt,
} from "../supabase/players-repository";
import ConfirmationOverlay from "./ConfirmationOverlay";

interface Props {
  onSelect: (challengeId: string, isFiveChars?: boolean) => void;
  onCancel: () => void;
}

// Palette keys rather than literals, resolved against the active theme at
// render time — the old fixed green/amber/red were tuned for a white card and
// went nearly unreadable on a dark one.
const DIFFICULTY_TOKENS: Record<string, "success" | "warning" | "danger"> = {
  Easy: "success",
  Medium: "warning",
  Hard: "danger",
};

/**
 * Days left in the challenge's window, or null if it never expires.
 * Rounded up, so the last partial day still reads as "1 day left".
 */
function daysRemaining(endDate: string | null): number | null {
  if (!endDate) return null;
  const ms = new Date(endDate).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export default function ChallengeSelector({ onSelect, onCancel }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [challenges, setChallenges] = useState<ChallengeMetadata[]>([]);
  const [attempts, setAttempts] = useState<Record<string, ChallengeAttempt>>({});
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState<{ title: string; message: string } | null>(null);
  const [replay, setReplay] = useState<ChallengeMetadata | null>(null);

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

  // A finished challenge is now replayable for as long as its week is open —
  // it used to be a permanent lock, which also meant a misclicked forfeit
  // closed the challenge for good.
  //
  // Confirmed rather than silent, because the replay does two things a player
  // would not expect from a tap: it wipes the attempt's stored progress, and it
  // does NOT improve their leaderboard placing. Only the first completed run
  // ranks (see 20260827_replay_and_duel_history.sql) — on a replay the five
  // words are already known, so ranking the best run would rank willingness to
  // replay and nothing else.
  const handleSelect = (c: ChallengeMetadata) => {
    const attempt = attempts[c.id];
    const isDone = attempt && (attempt.status === "completed" || attempt.status === "forfeited");

    if (isDone) {
      setReplay(c);
      return;
    }
    onSelect(c.id, c.is_five_chars);
  };

  const confirmReplay = async () => {
    const c = replay;
    if (!c) return;
    setReplay(null);
    const { success, error } = await restartChallengeAttempt(c.id);
    if (!success) {
      setWarning({
        title: t("challenge_replay_failed_title", { defaultValue: "Could Not Replay" }),
        message: error || t("challenge_replay_failed_msg", { defaultValue: "This challenge is no longer open." }),
      });
      return;
    }
    // Drop the stale attempt so a second tap doesn't re-prompt before the menu
    // is reloaded.
    setAttempts((prev) => {
      const next = { ...prev };
      delete next[c.id];
      return next;
    });
    onSelect(c.id, c.is_five_chars);
  };

  if (loading) {
    return <Text style={{ color: colors.textMuted, textAlign: "center", padding: 16 }}>{t("loading_challenges", { defaultValue: "Loading challenges..." })}</Text>;
  }

  return (
    <Card style={styles.card}>
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.warning }]}>{t("select_challenge", { defaultValue: "Select a Challenge" })}</Text>
        <Pressable onPress={onCancel}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t("cancel", { defaultValue: "Cancel" })}</Text>
        </Pressable>
      </View>

      {challenges.length === 0 ? (
        <View style={{ padding: 20, alignItems: "center" }}>
          <Text style={{ color: colors.textMuted }}>{t("no_challenges", { defaultValue: "No active challenges right now." })}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 4 }}>{t("check_back_tomorrow", { defaultValue: "A new challenge opens every Monday." })}</Text>
        </View>
      ) : (
        <ScrollView style={{ maxHeight: 420 }}>
          <View style={{ gap: 10 }}>
            {challenges.map((c) => {
              const attempt = attempts[c.id];
              const isDone = attempt && (attempt.status === "completed" || attempt.status === "forfeited");
              const isForfeit = attempt?.status === "forfeited";
              const categories = challengeCategoryNames(c, i18n.language);
              const daysLeft = daysRemaining(c.end_date);

              return (
                <Pressable
                  key={c.id}
                  style={[
                    styles.challengeCard,
                    { borderColor: colors.border, backgroundColor: colors.surfaceSunken },
                    isDone && styles.doneCard,
                  ]}
                  onPress={() => handleSelect(c)}
                >
                  {isDone && <Text style={styles.doneBadge}>{isForfeit ? "🏳️" : "✅"}</Text>}
                  {isDone && (
                    <Text style={[styles.replayHint, { color: colors.accent }]}>
                      🔁 {t("play_again", { defaultValue: "Play again" })}
                    </Text>
                  )}
                  <View style={styles.titleRow}>
                    <Text style={[styles.challengeName, { color: colors.text }]}>{c.name}</Text>
                    {c.is_five_chars && (
                      <View
                        style={[
                          styles.fiveBadge,
                          { backgroundColor: colors.successSoft, borderColor: colors.success },
                        ]}
                      >
                        <Text style={[styles.fiveBadgeText, { color: colors.success }]}>5x5</Text>
                      </View>
                    )}
                  </View>
                  {categories.length > 0 && (
                    <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>
                      {categories.join(" · ")}
                    </Text>
                  )}
                  <View style={styles.footerRow}>
                    <Text
                      style={{
                        color: colors[DIFFICULTY_TOKENS[c.difficulty]] || colors.textMuted,
                        fontWeight: "700",
                        fontSize: 11,
                      }}
                    >
                      {c.difficulty} · {c.word_count} {t("words", { defaultValue: "words" })}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {daysLeft !== null && (
                        <>
                          {/* `days`, not i18next's magic `count`: passing count
                              makes i18next look for days_left_one/_other and
                              silently fall through when they don't exist. */}
                          ⏳ {t("days_left", { days: daysLeft, defaultValue: `${daysLeft} d left` })}
                          {"  "}
                        </>
                      )}
                      👥 {c.completions_count || 0} {t("completed", { defaultValue: "completed" })}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {replay && (
        <ConfirmationOverlay
          title={t("challenge_replay_title", { defaultValue: "Play Again?" })}
          message={t("challenge_replay_msg", {
            defaultValue:
              "Your progress on this challenge will be reset. Only your first run counts towards the leaderboard, so this is just for fun.",
          })}
          onConfirm={confirmReplay}
          onCancel={() => setReplay(null)}
          confirmText={t("play_again", { defaultValue: "Play again" })}
          variant="warning"
        />
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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, paddingBottom: 10 },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  challengeCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 4, position: "relative" },
  // Was `opacity: 0.7` back when a finished challenge was permanently locked.
  // It is replayable now, so a disabled-looking card would be a lie; the ✅/🏳️
  // badge and the "Play again" hint carry the state instead.
  doneCard: {},
  doneBadge: { position: "absolute", top: 8, right: 10, fontSize: 16 },
  replayHint: { position: "absolute", bottom: 10, right: 10, fontSize: 10, fontWeight: "700" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  challengeName: { fontWeight: "700", fontSize: 14 },
  fiveBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  fiveBadgeText: { fontSize: 9, fontWeight: "800" },
  description: { fontSize: 11 },
  footerRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
});
