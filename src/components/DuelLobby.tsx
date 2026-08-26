import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import {
  Match,
  LobbyMatch,
  createMatch,
  listWaitingMatches,
  joinMatch,
  abandonMatch,
  DUEL_INVITE_LISTED_SECONDS,
} from "../supabase/matches-repository";
import { supabase } from "../supabaseClient";
import { getRandomFiveLetterWord } from "../supabase/words-repository";
import OptionButton from "./OptionButton";
import Card from "./ui/Card";
import Button from "./ui/Button";
import DuelIcon from "./DuelIcon";
import DuelLeaderboard from "./DuelLeaderboard";
import DuelChallengeCard from "./DuelChallengeCard";
import { MODE_BAR_INSET, modeBarStyles } from "./GameModeToggle";

interface Props {
  onMatchStart: (match: Match) => void;
  /**
   * The game-mode toggle, rendered top-right of whichever card this shows.
   * It replaces the "Quit mode" button that used to sit there: that button only
   * ever switched back to practice, which is precisely what the toggle's ☕ does
   * from the same corner.
   */
  modeToggle?: React.ReactNode;
}

export default function DuelLobby({ onMatchStart, modeToggle }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session } = useAuth();

  const [loading, setLoading] = useState(false);
  const [waitingMatches, setWaitingMatches] = useState<LobbyMatch[]>([]);
  const [myMatchId, setMyMatchId] = useState<string | null>(null);
  // When my own invitation was posted, and a per-second tick to count from it.
  // The creator used to sit on an indefinite "Waiting for opponent..." spinner
  // with no way to tell that the invitation had stopped being listed five
  // minutes ago and nobody could still find it.
  const [myMatchPostedAt, setMyMatchPostedAt] = useState<number | null>(null);
  const [inviteTick, setInviteTick] = useState(() => Date.now());
  const [duelLang, setDuelLang] = useState<"en" | "sv" | "fr">("en");
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

  // Ticks only while an invitation of mine is outstanding.
  useEffect(() => {
    if (!myMatchId || myMatchPostedAt === null) return;
    const interval = setInterval(() => setInviteTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [myMatchId, myMatchPostedAt]);

  const inviteSecondsLeft =
    myMatchPostedAt === null
      ? null
      : Math.max(0, DUEL_INVITE_LISTED_SECONDS - Math.floor((inviteTick - myMatchPostedAt) / 1000));
  const inviteLapsed = inviteSecondsLeft === 0;

  const handleCreateMatch = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const secret = await getRandomFiveLetterWord(duelLang);
      if (!secret) {
        setErrorMsg(t("no_secret_found", { defaultValue: "Could not find a valid 5-letter word." }));
        setLoading(false);
        return;
      }
      const newMatch = await createMatch(secret, duelLang);
      if (newMatch) {
        setMyMatchId(newMatch.id);
        // The server's own timestamp, not Date.now(): the lobby view filters on
        // created_at, so a clock skewed against the database would count down to
        // the wrong moment.
        setMyMatchPostedAt(new Date(newMatch.created_at).getTime());
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
      setMyMatchPostedAt(null);
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
      <Card style={styles.centerCard}>
        <View style={modeBarStyles.headerRow}>
          <View />
          {modeToggle}
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{t("duel_mode", { defaultValue: "Duel Mode" })}</Text>
        <Text style={{ color: colors.textMuted, textAlign: "center" }}>
          {t("visitor_duel_warning", { defaultValue: "Please sign in to play Duel mode." })}
        </Text>
      </Card>
    );
  }

  if (myMatchId) {
    return (
      <Card style={styles.centerCard}>
        <View style={modeBarStyles.headerRow}>
          <View />
          {modeToggle}
        </View>
        <View style={styles.waitingHeader}>
          <DuelIcon size={32} />
          <Text style={[styles.title, { color: colors.text }]}>{t("waiting_for_opponent", { defaultValue: "Waiting for opponent..." })}</Text>
        </View>
        {/* The spinner stops once the invitation stops being listed. Leaving it
            turning would keep promising activity that can no longer happen. */}
        {!inviteLapsed && <ActivityIndicator size="large" color={colors.accent} />}

        {inviteLapsed ? (
          <>
            <Text style={[styles.inviteExpired, { color: colors.warning }]}>
              ⌛ {t("invite_expired_title", { defaultValue: "No longer listed" })}
            </Text>
            {/* Not "expired": the row lives on and join_duel_match() still
                accepts it for another ten minutes, so someone whose lobby list
                was fetched just before the cutoff can still walk in. It is only
                unfindable, which is a different and more honest claim. */}
            <Text style={{ color: colors.textMuted, textAlign: "center" }}>
              {t("invite_expired_msg", {
                defaultValue:
                  "Nobody new can find this challenge now. Cancel and create a new one — or wait a moment longer, in case someone already had it open.",
              })}
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: colors.textMuted, textAlign: "center" }}>
              {t("waiting_for_player_accept", { defaultValue: "Your challenge is live. Waiting for someone to accept." })}
            </Text>
            {inviteSecondsLeft !== null && (
              <Text
                style={[
                  styles.inviteClock,
                  { color: inviteSecondsLeft <= 60 ? colors.warning : colors.textMuted },
                ]}
              >
                {t("invite_listed_for", { defaultValue: "Listed for" })}{" "}
                {Math.floor(inviteSecondsLeft / 60)}:
                {(inviteSecondsLeft % 60).toString().padStart(2, "0")}
              </Text>
            )}
          </>
        )}
        {errorMsg && <Text style={[styles.error, { color: colors.danger }]}>{errorMsg}</Text>}
        <Button
          variant="ghost"
          disabled={loading}
          label={
            loading
              ? t("cancelling", { defaultValue: "Cancelling..." })
              : t("cancel_challenge", { defaultValue: "Cancel & Exit" })
          }
          onPress={handleCancelMyMatch}
        />
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={modeBarStyles.headerRow}>
        <View style={styles.headerTitleRow}>
          <DuelIcon size={32} />
          <Text style={[styles.title, { color: colors.text }]}>{t("duel_arena", { defaultValue: "Duel Arena" })}</Text>
        </View>
        {modeToggle}
      </View>

      <View style={[styles.tabBar, { borderColor: colors.border }]}>
        <Pressable style={styles.tabButton} onPress={() => setView("lobby")}>
          <Text style={{ color: view === "lobby" ? colors.accent : colors.textMuted, fontWeight: view === "lobby" ? "700" : "500" }}>
            {t("lobby", { defaultValue: "Lobby" })}
          </Text>
        </Pressable>
        <Pressable style={styles.tabButton} onPress={() => setView("leaderboard")}>
          <Text style={{ color: view === "leaderboard" ? colors.accent : colors.textMuted, fontWeight: view === "leaderboard" ? "700" : "500" }}>
            {t("leaderboard", { defaultValue: "Leaderboard" })}
          </Text>
        </Pressable>
      </View>

      {view === "leaderboard" ? (
        <DuelLeaderboard />
      ) : (
        <ScrollView>
          <View style={[styles.optionRow, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
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

          {/* The hint toggle used to sit here, off by default. Removed: the
              duel secret comes from the whole language now, so without the
              category hint there is no anchor at all and the round is mostly
              unguessable. It was never a fairness problem — the flag is on the
              match, so both players always shared it — but it did let the
              creator choose the joiner's difficulty. See createMatch(). */}
          <Button
            fullWidth
            style={styles.createButton}
            loading={loading}
            label={`+ ${t("create_new_duel", { defaultValue: "Create New Duel" })}`}
            onPress={handleCreateMatch}
          />

          {errorMsg && <Text style={[styles.error, { color: colors.danger }]}>{errorMsg}</Text>}

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
    </Card>
  );
}

const styles = StyleSheet.create({
  inviteClock: { fontSize: 15, fontWeight: "800", fontFamily: "monospace" },
  inviteExpired: { fontSize: 15, fontWeight: "800" },
  centerCard: { ...MODE_BAR_INSET, paddingBottom: 24, alignItems: "center", gap: 12 },
  title: { fontSize: 18, fontWeight: "800" },
  waitingHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  error: { fontSize: 13, textAlign: "center", fontWeight: "600" },
  card: { ...MODE_BAR_INSET, paddingBottom: 18, gap: 12 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  tabBar: { flexDirection: "row", borderBottomWidth: 1 },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 10 },
  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 12, borderWidth: 1, borderRadius: 10, marginBottom: 10 },
  createButton: { marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginBottom: 8, marginTop: 4 },
});
