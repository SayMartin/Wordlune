import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import DuelDashboardHeader from "./DuelDashboardHeader";

interface Props {
  gameMode?: "practice" | "competitive" | "duel";
  status: string; // "idle" | "playing" | "paused" | "won" | "lost"
  secret?: string;
  poolCount?: number;
  hasSelection?: boolean;
  poolLoading?: boolean;
  onReset: () => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onExit?: () => void;
  hideRestart?: boolean;
  // Duel-only
  duelOpponentName?: string;
  onDuelForfeit?: () => void;
  elapsedTime?: number; // externally controlled (synced duel timer)
  language?: string;
  isHintEnabled?: boolean;
  // Competitive-only: overrides the main button's idle-state label
  // ("Start Challenge" instead of "Start Game").
  startLabel?: string;
  // Duel-only: when set, the timer switches to a red/pulsing countdown to
  // this timestamp instead of the normal elapsed-time display.
  suddenDeathEndTime?: number;
  // Extension slot for extra controls next to the exit button (e.g. a hint
  // toggle), matching the web version's `children` prop.
  children?: React.ReactNode;
}

export default function ControlDashboard({
  gameMode,
  status,
  secret,
  hasSelection = true,
  poolLoading = false,
  onReset,
  onStart,
  onPause,
  onResume,
  onExit,
  hideRestart = false,
  duelOpponentName,
  onDuelForfeit,
  elapsedTime,
  language,
  isHintEnabled,
  startLabel,
  suddenDeathEndTime,
  children,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [internalElapsed, setInternalElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [suddenDeathRemaining, setSuddenDeathRemaining] = useState<number | null>(null);

  const displayElapsed = elapsedTime !== undefined ? elapsedTime : internalElapsed;

  useEffect(() => {
    setInternalElapsed(0);
  }, [secret]);

  useEffect(() => {
    if (!suddenDeathEndTime) {
      setSuddenDeathRemaining(null);
      return;
    }
    const updateRemaining = () => {
      setSuddenDeathRemaining(Math.max(0, Math.ceil((suddenDeathEndTime - Date.now()) / 1000)));
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [suddenDeathEndTime]);

  useEffect(() => {
    setRunning(status === "playing");
  }, [status]);

  useEffect(() => {
    if (elapsedTime !== undefined) return;
    if (!running) return;
    const id = setInterval(() => setInternalElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running, elapsedTime]);

  function formatTime(s: number) {
    const mm = Math.floor(s / 60).toString().padStart(2, "0");
    const ss = Math.floor(s % 60).toString().padStart(2, "0");
    return `${mm}:${ss}`;
  }

  const disabled = !hasSelection || poolLoading;
  const isDuel = gameMode === "duel";

  function handleMainAction() {
    if (disabled) return;
    if (status === "playing") onPause();
    else if (status === "paused") onResume();
    else if (status === "won" || status === "lost") {
      onReset();
      onStart();
      setInternalElapsed(0);
    } else {
      onStart();
      setInternalElapsed(0);
    }
  }

  const mainLabel =
    status === "playing"
      ? t("pause_game", { defaultValue: "Pause" })
      : status === "paused"
        ? t("resume_game", { defaultValue: "Resume" })
        : status === "won" || status === "lost"
          ? t("play_again", { defaultValue: "Play Again" })
          : startLabel || t("play_now", { defaultValue: "Start Game" });

  const showMainButton = !((status === "won" || status === "lost") && hideRestart);

  return (
    <View style={{ gap: 10 }}>
      {isDuel && duelOpponentName && (
        <DuelDashboardHeader
          duelOpponentName={duelOpponentName}
          onDuelForfeit={onDuelForfeit}
          language={language}
          secret={secret}
          isHintEnabled={isHintEnabled}
        />
      )}

      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cluster}>
          {showMainButton && (
            <Pressable
              style={[styles.mainButton, disabled ? styles.disabledButton : styles.activeButton]}
              onPress={handleMainAction}
              disabled={disabled}
            >
              {poolLoading ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.mainButtonText}>{mainLabel}</Text>
              )}
            </Pressable>
          )}

          {!isDuel && !hideRestart && (
            <Pressable
              style={[styles.resetButton, { borderColor: colors.border }, (status === "idle" || disabled) && styles.disabledIcon]}
              onPress={() => {
                onReset();
                setInternalElapsed(0);
              }}
              disabled={status === "idle" || disabled}
            >
              <Text style={{ color: colors.text }}>↻</Text>
            </Pressable>
          )}

          <Text
            style={[
              styles.timer,
              suddenDeathRemaining !== null
                ? styles.suddenDeathTimer
                : { color: "#4f46e5" },
            ]}
          >
            {suddenDeathRemaining !== null ? formatTime(suddenDeathRemaining) : formatTime(displayElapsed)}
          </Text>
        </View>

        <View style={styles.cluster}>
          {children}
          {onExit && (
            <Pressable style={styles.exitButton} onPress={onExit}>
              <Text style={styles.exitButtonText}>{t("quit_game", { defaultValue: "Quit" })}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {!hasSelection && (
        <Text style={styles.hint}>{t("select_subcategories_to_enable", { defaultValue: "Select subcategories to enable game" })}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  cluster: { flexDirection: "row", alignItems: "center", gap: 10 },
  mainButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  activeButton: { backgroundColor: "#4f46e5" },
  disabledButton: { backgroundColor: "#94a3b8" },
  mainButtonText: { color: "#ffffff", fontWeight: "700" },
  resetButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 12 },
  disabledIcon: { opacity: 0.4 },
  timer: { fontWeight: "700", fontSize: 16, fontVariant: ["tabular-nums"] },
  suddenDeathTimer: { color: "#dc2626", fontSize: 20 },
  hint: { textAlign: "center", color: "#ef4444", fontWeight: "600", fontSize: 13 },
  exitButton: {
    backgroundColor: "#fed7aa",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  exitButtonText: { color: "#c2410c", fontWeight: "700" },
});
