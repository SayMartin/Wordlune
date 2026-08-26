import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

export interface DuelClockState {
  silenceSecondsLeft: number;
  mySecondsLeft: number;
  opponentSecondsLeft: number;
  inactivityDormant: boolean;
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

/**
 * All three clocks, always. Any of them can end the duel, so hiding one until
 * it matters means being surprised by it. Left to right they run from the least
 * to the most urgent: the whole match, then each player's own inactivity limit.
 *
 * The two player clocks grey out together when both players are idle past the
 * limit — neither can fire then, because the forfeit rule only works against a
 * player whose opponent is still going, and the match clock is what settles it.
 * Showing them live at 0:00 while nothing happened would read as a broken timer.
 *
 * These sit in ControlDashboard's bar rather than in the duel header: they take
 * the place of the elapsed-time counter, which measures nothing a duel is
 * decided on. Three deadlines that can each end the match belong where the
 * player already looks for the time.
 */
export default function DuelClocks({ clocks }: { clocks: DuelClockState }) {
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      <ClockPill
        icon="⏳"
        label={t("duel_clock_match", { defaultValue: "Match" })}
        seconds={clocks.silenceSecondsLeft}
        total={480}
      />
      <ClockPill
        icon="🙋"
        label={t("duel_clock_you", { defaultValue: "You" })}
        seconds={clocks.mySecondsLeft}
        total={120}
        dimmed={clocks.inactivityDormant}
      />
      <ClockPill
        icon="👤"
        label={t("duel_clock_opponent", { defaultValue: "Opp" })}
        seconds={clocks.opponentSecondsLeft}
        total={120}
        dimmed={clocks.inactivityDormant}
      />
    </View>
  );
}

/**
 * Urgency is proportional, not absolute: a quarter of the clock left is the
 * warning point and a tenth is the alarm, so the 8-minute match timer and the
 * 2-minute player timers escalate at the same *relative* moment instead of the
 * match clock sitting green until it suddenly isn't.
 */
function ClockPill({
  icon,
  label,
  seconds,
  total,
  dimmed = false,
}: {
  icon: string;
  label: string;
  seconds: number;
  total: number;
  dimmed?: boolean;
}) {
  const { colors } = useTheme();
  const fraction = total > 0 ? seconds / total : 1;
  const tone = dimmed
    ? { color: colors.textMuted, borderColor: colors.border }
    : fraction <= 0.1
      ? { color: colors.danger, borderColor: colors.danger }
      : fraction <= 0.25
        ? { color: colors.warning, borderColor: colors.warning }
        : { color: colors.textMuted, borderColor: colors.border };

  return (
    <View style={[styles.pill, { borderColor: tone.borderColor }, dimmed && styles.dimmed]}>
      <Text style={[styles.label, { color: tone.color }]} numberOfLines={1}>
        {icon} {label}
      </Text>
      <Text style={[styles.value, { color: tone.color }]}>{mmss(seconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 72,
  },
  dimmed: { opacity: 0.45 },
  label: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontSize: 18, fontWeight: "800", fontFamily: "monospace" },
});
