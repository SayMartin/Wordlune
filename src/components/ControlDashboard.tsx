import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import DuelDashboardHeader from "./DuelDashboardHeader";
import DuelClocks, { DuelClockState } from "./DuelClocks";

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
  duelClocks?: DuelClockState;
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
  poolCount,
  hasSelection = true,
  poolLoading = false,
  onReset,
  onStart,
  onPause,
  onResume,
  onExit,
  hideRestart = false,
  duelOpponentName,
  duelClocks,
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
  const mainButtonRef = useRef<any>(null);
  const resetButtonRef = useRef<any>(null);

  // react-native-web's Pressable hijacks a physical Enter keypress whenever
  // it still holds DOM focus (its own keydown handler stops propagation and
  // fires onPress via a document keyup listener) — `focusable={false}` alone
  // does NOT prevent this, since tabIndex=-1 elements can still be focused by
  // a mouse click. Blurring right after a click/tap is the only reliable way
  // to stop a later physical Enter (used to submit a guess) from re-hitting
  // this button instead of GameScreen's own keydown handler.
  function blurAfterPress(ref: React.RefObject<any>) {
    if (Platform.OS === "web" && ref.current && typeof ref.current.blur === "function") {
      ref.current.blur();
    }
  }

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

  const noWordsFound = poolCount !== undefined && poolCount === 0 && !poolLoading;
  const disabled = !hasSelection || poolLoading || noWordsFound;
  const isDuel = gameMode === "duel";

  function handleMainAction() {
    blurAfterPress(mainButtonRef);
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

  // Icon-only main button: the glyph carries the meaning, the label below is
  // kept only for accessibilityLabel (screen readers, not visible text).
  const mainIcon = status === "playing" ? "⏸" : "▶";
  const mainLabel =
    status === "playing"
      ? t("pause_short", { defaultValue: "Pause" })
      : status === "paused"
        ? t("resume_short", { defaultValue: "Resume" })
        : status === "won" || status === "lost"
          ? t("play_again", { defaultValue: "Play Again" })
          : startLabel || t("start_short", { defaultValue: "Start" });

  const showMainButton = !((status === "won" || status === "lost") && hideRestart);

  return (
    <View style={{ gap: 10 }}>
      {isDuel && duelOpponentName && (
        <DuelDashboardHeader
          duelOpponentName={duelOpponentName}
          onExit={onExit}
          language={language}
          secret={secret}
          isHintEnabled={isHintEnabled}
        />
      )}

      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cluster}>
          {showMainButton && (
            <Pressable
              style={[
                styles.mainButton,
                styles.noWebOutline,
                disabled
                  ? [{ backgroundColor: colors.surfaceHover, borderColor: colors.border }, styles.disabledState]
                  : { backgroundColor: colors.accent, borderColor: colors.accentHover },
              ]}
              ref={mainButtonRef}
              onPress={handleMainAction}
              disabled={disabled}
              accessibilityLabel={mainLabel}
              focusable={false}
            >
              {poolLoading ? (
                <ActivityIndicator color={disabled ? colors.text : colors.onAccent} />
              ) : (
                <Text style={[styles.mainButtonIcon, { color: disabled ? colors.text : colors.onAccent }]}>
                  {mainIcon}
                </Text>
              )}
            </Pressable>
          )}

          {!isDuel && !hideRestart && (
            <Pressable
              style={[
                styles.resetButton,
                styles.noWebOutline,
                status === "idle" || disabled
                  ? [{ borderColor: colors.border }, styles.disabledState]
                  : { borderColor: colors.accent },
              ]}
              ref={resetButtonRef}
              onPress={() => {
                blurAfterPress(resetButtonRef);
                onReset();
                setInternalElapsed(0);
              }}
              disabled={status === "idle" || disabled}
              accessibilityLabel={t("reset", { defaultValue: "Reset" })}
              focusable={false}
            >
              <Text
                style={[
                  styles.resetButtonIcon,
                  { color: status === "idle" || disabled ? colors.textMuted : colors.accent },
                ]}
              >
                ↻
              </Text>
            </Pressable>
          )}

          {/* Sudden death outranks everything: it is a single hard deadline
              that decides the match, so it takes the whole slot rather than
              competing with three clocks that can no longer be the thing that
              ends it. Otherwise a duel shows its clocks here and every other
              mode shows elapsed time — counting up in a duel measures nothing
              the match is decided on. */}
          {suddenDeathRemaining !== null ? (
            <Text style={[styles.timer, { color: colors.danger }]}>{formatTime(suddenDeathRemaining)}</Text>
          ) : isDuel && duelClocks ? (
            <DuelClocks clocks={duelClocks} />
          ) : (
            <Text style={[styles.timer, { color: colors.accent }]}>{formatTime(displayElapsed)}</Text>
          )}
        </View>

        <View style={styles.cluster}>
          {children}
          {isDuel && duelOpponentName && onDuelForfeit ? (
            <Pressable
              style={[styles.forfeitButton, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}
              onPress={onDuelForfeit}
            >
              <Text style={[styles.forfeitText, { color: colors.danger }]}>
                🏳️ {t("surrender", { defaultValue: "Surrender" })}
              </Text>
            </Pressable>
          ) : (
            onExit && (
              <Pressable
                style={[styles.exitButton, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
                onPress={onExit}
              >
                <Text style={[styles.exitButtonText, { color: colors.warning }]}>
                  {t("quit_game", { defaultValue: "Quit" })}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </View>

      {!hasSelection && (
        <Text style={[styles.hint, { color: colors.warning }]}>
          {t("select_subcategories_to_enable", { defaultValue: "Select subcategories to enable game" })}
        </Text>
      )}
      {hasSelection && noWordsFound && (
        <Text style={[styles.hint, { color: colors.warning }]}>
          {t("no_words_for_filter", { defaultValue: "No words match the current letter range — widen it to start" })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    rowGap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  cluster: { flexDirection: "row", alignItems: "center", flexShrink: 1, gap: 10 },
  // Browser default focus outlines follow whichever button was last clicked,
  // not app state — suppressed so the border below is the only ring shown.
  noWebOutline: Platform.OS === "web" ? { outlineWidth: 0 } : {},
  mainButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  mainButtonIcon: { fontSize: 18 },
  resetButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  resetButtonIcon: { fontSize: 20, fontWeight: "700" },
  // Shared disabled recipe for every control on this bar: neutral fill/border
  // (applied inline with theme colors) plus a uniform opacity fade — no
  // control should invent its own disabled look.
  disabledState: { opacity: 0.4 },
  timer: { fontWeight: "700", fontSize: 20, fontVariant: ["tabular-nums"] },
  hint: { textAlign: "center", fontWeight: "600", fontSize: 13 },
  exitButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  exitButtonText: { fontWeight: "700" },
  forfeitButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  forfeitText: { fontWeight: "700", fontSize: 15 },
});
