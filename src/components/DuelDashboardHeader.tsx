import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import DuelIcon from "./DuelIcon";
import Card from "./ui/Card";
import { getExtensionsForWord } from "../supabase/words-repository";
import { flagFor } from "../utils/languageCycle";

interface Props {
  duelOpponentName: string;
  onDuelForfeit?: () => void;
  language?: string;
  secret?: string;
  isHintEnabled?: boolean;
  clocks?: {
    silenceSecondsLeft: number;
    mySecondsLeft: number;
    opponentSecondsLeft: number;
    inactivityDormant: boolean;
  };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

export default function DuelDashboardHeader({ duelOpponentName, onDuelForfeit, language, secret, isHintEnabled, clocks }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [wordSubcats, setWordSubcats] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    const lookupLang = language?.split("-")[0] || "en";
    if (secret) {
      getExtensionsForWord(secret.trim(), lookupLang).then((data) => {
        setWordSubcats(data?.subcategories || []);
      });
    } else {
      setWordSubcats([]);
    }
  }, [secret, language]);

  return (
    <Card style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <DuelIcon size={36} />
          <View>
            <Text style={[styles.vsLabel, { color: colors.textMuted }]}>
              {t("dueling_against", { defaultValue: "Dueling vs" })}
            </Text>
            <Text style={[styles.opponentName, { color: colors.accent2 }]}>{duelOpponentName}</Text>
          </View>
          <View style={styles.statusCol}>
            {language && (
              <Text style={[styles.langBadge, { color: colors.textMuted, borderColor: colors.border }]}>
                {flagFor(language)} {language.split("-")[0].toUpperCase()}
              </Text>
            )}
            <Text style={{ opacity: isHintEnabled ? 1 : 0.25, fontSize: 16 }}>💡</Text>
          </View>
        </View>

        {/* All three clocks, always. Any of them can end the duel, so hiding one
            until it matters means being surprised by it. Left to right they run
            from the least to the most urgent: the whole match, then each
            player's own inactivity limit.

            The two player clocks grey out together when both players are idle
            past the limit — neither can fire then, because the forfeit rule only
            works against a player whose opponent is still going, and the match
            clock is what settles it. Showing them live at 0:00 while nothing
            happened would read as a broken timer. */}
        {clocks && (
          <View style={styles.clockRow}>
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
        )}

        {onDuelForfeit && (
          <Pressable
            style={[styles.forfeitButton, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}
            onPress={onDuelForfeit}
          >
            <Text style={[styles.forfeitText, { color: colors.danger }]}>
              🏳️ {t("surrender", { defaultValue: "Surrender" })}
            </Text>
          </Pressable>
        )}
      </View>

      {/* The secret's own subcategories, the same hint the practice screen shows
          (LetterSlider's hintNames).

          This used to render a fixed row of every Hydrocarbons subcategory and
          highlight the ones the secret belonged to — a decoy-and-reveal design
          that only worked while every duel secret came from that one category.
          Now that the secret is drawn from the whole dictionary, those chips
          would simply never light up for a country or a car brand, so the hint
          shows what the word actually is filed under instead. */}
      {isHintEnabled && wordSubcats.length > 0 && (
        <View style={[styles.chipRow, { borderColor: colors.border }]}>
          {wordSubcats.map((sub) => (
            <View
              key={sub.id}
              style={[
                styles.chip,
                { backgroundColor: colors.warningSoft, borderColor: colors.warning },
              ]}
            >
              <Text style={[styles.chipText, styles.chipTextActive, { color: colors.warning }]}>
                {sub.name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
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
    <View style={[styles.clockPill, { borderColor: tone.borderColor }, dimmed && styles.clockDimmed]}>
      <Text style={[styles.clockLabel, { color: tone.color }]} numberOfLines={1}>
        {icon} {label}
      </Text>
      <Text style={[styles.clockValue, { color: tone.color }]}>{mmss(seconds)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 10 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  identity: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  vsLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  opponentName: { fontSize: 16, fontWeight: "800" },
  statusCol: { alignItems: "center", gap: 4, marginLeft: 8 },
  langBadge: { fontSize: 10, fontWeight: "700", borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  clockRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginRight: 8 },
  clockPill: {
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minWidth: 54,
  },
  clockDimmed: { opacity: 0.45 },
  clockLabel: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  clockValue: { fontSize: 13, fontWeight: "800", fontFamily: "monospace" },
  forfeitButton: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  forfeitText: { fontWeight: "700", fontSize: 11 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, borderTopWidth: 1, paddingTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 10 },
  chipTextActive: { fontWeight: "800" },
});
