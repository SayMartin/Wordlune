import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { Match, LobbyMatch, createMatch, listWaitingMatches, joinMatch, abandonMatch } from "../supabase/matches-repository";
import { supabase } from "../supabaseClient";
import { getFiveLetterHydrocarbon } from "../supabase/words-repository";
import Toggle from "./Toggle";
import OptionButton from "./OptionButton";
import DuelIcon from "./DuelIcon";
import DuelLeaderboard from "./DuelLeaderboard";
import DuelChallengeCard from "./DuelChallengeCard";

interface Props {
  onMatchStart: (match: Match) => void;
  onExit?: () => void;
}

export default function DuelLobby({ onMatchStart, onExit }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session } = useAuth();

  const [loading, setLoading] = useState(false);
  const [waitingMatches, setWaitingMatches] = useState<LobbyMatch[]>([]);
  const [myMatchId, setMyMatchId] = useState<string | null>(null);
  const [duelLang, setDuelLang] = useState<"en" | "sv" | "fr">("en");
  const [showHint, setShowHint] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [view, setView] = useState<"lobby" | "leaderboard">("lobby");

  useEffect(() => {
    if (myMatchId) return;
    const fetchMatches = async () => {
      const matches = await listWaitingMatches();
      setWaitingMatches(matches);
    };
    fetchMatches();
    const interval = setInterval(fetchMatches, 5000);
    return () => clearInterval(interval);
  }, [myMatchId]);

  useEffect(() => {
    if (!myMatchId) return;

    const channel = supabase
      .channel(`match:${myMatchId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "duel_matches", filter: `id=eq.${myMatchId}` },
        async (payload: any) => {
          const updated = payload.new as Match;
          if (updated.status === "playing" && updated.player2_id) {
            const { data } = await supabase.from("duel_matches").select("*").eq("id", myMatchId).single();
            onMatchStart((data as Match) || updated);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myMatchId, onMatchStart]);

  const handleCreateMatch = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const secret = await getFiveLetterHydrocarbon(duelLang);
      if (!secret) {
        setErrorMsg(t("no_secret_found", { defaultValue: "Could not find a valid 5-letter hydrocarbon word." }));
        setLoading(false);
        return;
      }
      const newMatch = await createMatch(secret, duelLang, showHint);
      if (newMatch) {
        setMyMatchId(newMatch.id);
      } else {
        setErrorMsg(t("match_creation_failed", { defaultValue: "Failed to create match." }));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(t("match_creation_error", { defaultValue: "An error occurred while creating match." }));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinMatch = async (matchId: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const match = await joinMatch(matchId);
      if (match) {
        onMatchStart(match);
      } else {
        setErrorMsg(t("match_join_failed", { defaultValue: "Failed to join match. It may have been taken." }));
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(t("match_join_error", { defaultValue: "An error occurred while joining match." }));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelMyMatch = async () => {
    if (!myMatchId) return;
    setLoading(true);
    try {
      await abandonMatch(myMatchId);
      setWaitingMatches((prev) => prev.filter((m) => m.id !== myMatchId));
      setMyMatchId(null);
    } catch (err) {
      console.error("Failed to abandon match", err);
      setErrorMsg(t("failed_cancel_match", { defaultValue: "Failed to cancel match. It may persist in the lobby." }));
    }
    setLoading(false);
  };

  if (!session) {
    return (
      <View style={[styles.centerCard, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>{t("duel_mode", { defaultValue: "Duel Mode" })}</Text>
        <Text style={{ color: colors.textMuted, textAlign: "center" }}>
          {t("visitor_duel_warning", { defaultValue: "Please sign in to play Duel mode." })}
        </Text>
      </View>
    );
  }

  if (myMatchId) {
    return (
      <View style={[styles.centerCard, { backgroundColor: colors.surface }]}>
        <View style={styles.waitingHeader}>
          <DuelIcon size={32} />
          <Text style={[styles.title, { color: colors.text }]}>{t("waiting_for_opponent", { defaultValue: "Waiting for opponent..." })}</Text>
        </View>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={{ color: colors.textMuted, textAlign: "center" }}>
          {t("waiting_for_player_accept", { defaultValue: "Your challenge is live. Waiting for someone to accept." })}
        </Text>
        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
        <Pressable style={styles.cancelButton} onPress={handleCancelMyMatch} disabled={loading}>
          <Text style={styles.cancelButtonText}>
            {loading ? t("cancelling", { defaultValue: "Cancelling..." }) : t("cancel_challenge", { defaultValue: "Cancel & Exit" })}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <View style={styles.headerTitleRow}>
          <DuelIcon size={32} />
          <Text style={[styles.title, { color: colors.text }]}>{t("duel_arena", { defaultValue: "Duel Arena" })}</Text>
        </View>
        {onExit && (
          <Pressable style={styles.exitButton} onPress={onExit}>
            <Text style={styles.exitButtonText}>{t("quit_duel_lobby", { defaultValue: "Quit" })}</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.tabBar, { borderColor: colors.border }]}>
        <Pressable style={styles.tabButton} onPress={() => setView("lobby")}>
          <Text style={{ color: view === "lobby" ? "#4f46e5" : colors.textMuted, fontWeight: view === "lobby" ? "700" : "500" }}>
            {t("lobby", { defaultValue: "Lobby" })}
          </Text>
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => setView("leaderboard")}>
          <Text style={{ color: view === "leaderboard" ? "#4f46e5" : colors.textMuted, fontWeight: view === "leaderboard" ? "700" : "500" }}>
            {t("leaderboard", { defaultValue: "Leaderboard" })}
          </Text>
        </Pressable>
      </View>

      {view === "leaderboard" ? (
        <DuelLeaderboard />
      ) : (
        <ScrollView>
          <View style={[styles.optionRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <OptionButton active={duelLang === "en"} onPress={() => setDuelLang("en")}>
              🇬🇧 EN
            </OptionButton>
            <OptionButton active={duelLang === "sv"} onPress={() => setDuelLang("sv")}>
              🇸🇪 SV
            </OptionButton>
            <OptionButton active={duelLang === "fr"} onPress={() => setDuelLang("fr")}>
              🇫🇷 FR
            </OptionButton>
          </View>

          <View style={[styles.optionRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={{ fontSize: 18, opacity: showHint ? 1 : 0.3 }}>💡</Text>
            <Text style={{ color: colors.textMuted }}>{t("no_hint", { defaultValue: "No hint" })}</Text>
            <Toggle checked={showHint} onChange={setShowHint} />
            <Text style={{ color: showHint ? "#4f46e5" : colors.textMuted, fontWeight: showHint ? "700" : "400" }}>
              {t("show_hint", { defaultValue: "Show hint" })}
            </Text>
          </View>

          <Pressable style={[styles.createButton, loading && styles.disabled]} onPress={handleCreateMatch} disabled={loading}>
            <Text style={styles.createButtonText}>
              {loading ? t("creating", { defaultValue: "Creating..." }) : `+ ${t("create_new_duel", { defaultValue: "Create New Duel" })}`}
            </Text>
          </Pressable>

          {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            {t("open_challenges", { defaultValue: "Open Challenges" })}
          </Text>

          {waitingMatches.length === 0 ? (
            <Text style={{ color: colors.textMuted, textAlign: "center", padding: 16, fontStyle: "italic" }}>
              {t("no_active_challenges", { defaultValue: "No active challenges. Start one!" })}
            </Text>
          ) : (
            <View style={{ gap: 10 }}>
              {waitingMatches.map((m) => (
                <DuelChallengeCard key={m.id} match={m} onJoin={handleJoinMatch} loading={loading} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  centerCard: { borderRadius: 16, padding: 24, alignItems: "center", gap: 12 },
  title: { fontSize: 18, fontWeight: "800" },
  waitingHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  error: { color: "#dc2626", fontSize: 13, textAlign: "center", fontWeight: "600" },
  cancelButton: { borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16 },
  cancelButtonText: { color: "#dc2626", fontWeight: "700", fontSize: 13 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  exitButton: { borderWidth: 1, borderColor: "#fed7aa", backgroundColor: "#fff7ed", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  exitButtonText: { color: "#c2410c", fontWeight: "700", fontSize: 12 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 10 },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 10 },
  createButton: { backgroundColor: "#4f46e5", borderRadius: 10, paddingVertical: 14, alignItems: "center", marginBottom: 10 },
  disabled: { opacity: 0.6 },
  createButtonText: { color: "#ffffff", fontWeight: "700" },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 8, marginTop: 4 },
});
