import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import {
  BASE_POINTS,
  MAX_GUESSES,
  MAX_TIME_BONUS,
  POINTS_PER_EXTRA_GUESS,
  ScoreBreakdown,
  formatDuration,
} from "../utils/scoring";

/**
 * Shows the arithmetic behind a score rather than just its result.
 *
 * Two shapes, because the database stores two shapes: a single word
 * (`game_scores`, and every result overlay) carries the guess count and the
 * duration that produced it, while a finished challenge (`challenge_results`)
 * only ever kept the totals across its five words — the per-word rows are
 * deliberately not persisted (see useChallengeMode). So the aggregate variant
 * explains the sum and points at the per-word rule instead of inventing detail
 * it does not have.
 */

interface RowProps {
  label: string;
  detail?: string;
  math?: string;
  value: string;
  emphasis?: boolean;
}

function MathRow({ label, detail, math, value, emphasis }: RowProps) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, emphasis && styles.rowEmphasis, emphasis && { borderTopColor: colors.border }]}>
      <View style={styles.rowLabel}>
        <Text style={[styles.label, { color: emphasis ? colors.text : colors.textMuted }, emphasis && styles.labelStrong]}>
          {label}
        </Text>
        {!!detail && <Text style={[styles.detail, { color: colors.textMuted }]}>{detail}</Text>}
      </View>
      {!!math && (
        <Text style={[styles.math, { color: colors.textMuted }]} numberOfLines={1}>
          {math}
        </Text>
      )}
      <Text style={[styles.value, { color: emphasis ? colors.accent : colors.text }, emphasis && styles.valueStrong]}>
        {value}
      </Text>
    </View>
  );
}

export function WordScoreMath({
  breakdown,
  storedScore,
  matchesStored = true,
}: {
  breakdown: ScoreBreakdown;
  storedScore?: number;
  matchesStored?: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const total = storedScore ?? breakdown.total;

  if (!breakdown.won) {
    return (
      <View style={styles.mathBlock}>
        <MathRow
          label={t("score_not_solved", { defaultValue: "Word not solved" })}
          detail={t("score_not_solved_detail", { defaultValue: "No points are awarded for a word you miss, skip or give up." })}
          value="0"
          emphasis
        />
      </View>
    );
  }

  const guessPenalty = (Math.min(MAX_GUESSES, Math.max(1, breakdown.guesses)) - 1) * POINTS_PER_EXTRA_GUESS;
  const timePenalty = MAX_TIME_BONUS - breakdown.timeBonus;

  const guessRow = (
    <MathRow
      label={t("score_guess_points", { defaultValue: "Guess points" })}
      detail={t("score_of_max_guesses", {
        used: breakdown.guesses,
        max: MAX_GUESSES,
        defaultValue: `${breakdown.guesses} of ${MAX_GUESSES} guesses`,
      })}
      math={`${BASE_POINTS} − ${guessPenalty}`}
      value={String(breakdown.guessPoints)}
    />
  );

  // A row saved under the old formula IS just its guess points — the time bonus
  // did not exist. Showing the bonus row anyway would print "70 + 39" above a
  // total of 70, i.e. arithmetic that does not add up, which is worse than no
  // breakdown at all on a screen whose entire job is to make the number
  // believable. So the legacy case shows the half that is true and says why the
  // other half is missing.
  if (!matchesStored) {
    return (
      <View style={styles.mathBlock}>
        {guessRow}
        <MathRow label={t("score_total", { defaultValue: "Total" })} value={String(total)} emphasis />
        <Text style={[styles.note, { color: colors.textMuted, borderColor: colors.border }]}>
          {t("score_legacy_note", {
            max: BASE_POINTS,
            defaultValue: `This score was saved before the time bonus existed, so it was capped at ${BASE_POINTS}. The rules below are how it would be scored today.`,
          })}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.mathBlock}>
      {guessRow}
      <MathRow
        label={t("score_time_bonus", { defaultValue: "Time bonus" })}
        detail={t("score_time_detail", {
          time: formatDuration(breakdown.durationSeconds),
          free: formatDuration(breakdown.freeSeconds),
          defaultValue: `${formatDuration(breakdown.durationSeconds)} used, ${formatDuration(breakdown.freeSeconds)} free`,
        })}
        math={`${MAX_TIME_BONUS} − ${timePenalty}`}
        value={String(breakdown.timeBonus)}
      />
      <MathRow
        label={t("score_total", { defaultValue: "Total" })}
        math={`${breakdown.guessPoints} + ${breakdown.timeBonus}`}
        value={String(total)}
        emphasis
      />
    </View>
  );
}

export function AggregateScoreMath({
  totalScore,
  totalGuesses,
  totalDuration,
  wordCount,
}: {
  totalScore: number;
  totalGuesses: number;
  totalDuration: number;
  wordCount?: number;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.mathBlock}>
      {wordCount != null && (
        <MathRow label={t("score_words", { defaultValue: "Words" })} value={String(wordCount)} />
      )}
      <MathRow
        label={t("score_total_guesses", { defaultValue: "Guesses in total" })}
        value={String(totalGuesses)}
      />
      <MathRow
        label={t("score_total_time", { defaultValue: "Time in total" })}
        value={formatDuration(totalDuration)}
      />
      <MathRow label={t("score_total", { defaultValue: "Total" })} value={String(totalScore)} emphasis />

      <Text style={[styles.note, { color: colors.textMuted, borderColor: colors.border }]}>
        {t("score_aggregate_note", {
          defaultValue:
            "A challenge score is the sum of the score for each word in it. Only the totals are stored, so the words cannot be broken out individually.",
        })}
      </Text>
    </View>
  );
}

/** The rules themselves, in prose — also rendered as its own About section. */
export function ScoringRules({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const rules = [
    t("scoring_rule_guess", {
      base: BASE_POINTS,
      step: POINTS_PER_EXTRA_GUESS,
      floor: BASE_POINTS - (MAX_GUESSES - 1) * POINTS_PER_EXTRA_GUESS,
      defaultValue: `Solving a word gives ${BASE_POINTS} points, minus ${POINTS_PER_EXTRA_GUESS} for every guess after the first — so ${BASE_POINTS} on the first guess down to ${BASE_POINTS - (MAX_GUESSES - 1) * POINTS_PER_EXTRA_GUESS} on the sixth.`,
    }),
    t("scoring_rule_time", {
      bonus: MAX_TIME_BONUS,
      defaultValue: `On top of that comes a time bonus of up to ${MAX_TIME_BONUS} points.`,
    }),
    t("scoring_rule_free_time", {
      perLetter: 10,
      defaultValue:
        "You get 10 seconds of free thinking time per letter — 50 seconds for a five-letter word — and the bonus only starts to drop after that.",
    }),
    t("scoring_rule_decay", {
      defaultValue: "Past the free time you lose one point of bonus every two seconds, down to zero.",
    }),
    t("scoring_rule_lost", {
      defaultValue: "A word you miss, skip or give up scores nothing at all.",
    }),
  ];

  return (
    <View style={styles.rulesBlock}>
      {!compact && (
        <Text style={[styles.rulesIntro, { color: colors.textMuted }]}>
          {t("scoring_rules_intro", {
            max: BASE_POINTS + MAX_TIME_BONUS,
            defaultValue: `Practice and challenge words are scored the same way, out of a maximum of ${BASE_POINTS + MAX_TIME_BONUS} points per word.`,
          })}
        </Text>
      )}
      {rules.map((rule, i) => (
        <Text key={i} style={[styles.rule, { color: colors.textMuted }]}>
          • {rule}
        </Text>
      ))}
      <Text style={[styles.rule, { color: colors.textMuted }]}>
        •{" "}
        {t("scoring_rule_duel", {
          correct: 5,
          present: 2,
          defaultValue:
            "Duel is scored differently: 5 points for every letter in the right place and 2 for every letter that is in the word but misplaced, counted as you guess.",
        })}
      </Text>
    </View>
  );
}

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  /** Optional: a leaderboard row has a score but none of the inputs behind it,
      so it opens this modal for the rules alone. */
  children?: React.ReactNode;
}

export default function ScoreBreakdownModal({ visible, onClose, title, subtitle, children }: ModalProps) {
  const { t } = useTranslation();
  const { colors, radii } = useTheme();
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Opaque, not the glass surface — see PracticeResultOverlay. */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surfaceSolid, borderColor: colors.border, borderRadius: radii.lg },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {!!subtitle && <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>}

          {/* The rules list runs long in Swedish and French, and this modal has
              to fit a phone in landscape — so the body scrolls rather than
              pushing the close button off the bottom. */}
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {children}
            <View style={[styles.rulesDivider, { borderTopColor: colors.border }]}>
              <Text style={[styles.rulesHeading, { color: colors.text }]}>
                {t("scoring_rules_title", { defaultValue: "How points are scored" })}
              </Text>
              <ScoringRules compact />
            </View>
          </ScrollView>

          <Pressable style={[styles.button, { backgroundColor: colors.surfaceHover }]} onPress={onClose}>
            <Text style={[styles.buttonText, { color: colors.text }]}>{t("close", { defaultValue: "Close" })}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 400, maxHeight: "90%", borderWidth: 1, padding: 20, gap: 4 },
  title: { fontSize: 18, fontWeight: "800" },
  subtitle: { fontSize: 13 },
  body: { marginTop: 12 },
  bodyContent: { gap: 12 },
  mathBlock: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowEmphasis: { borderTopWidth: 1, paddingTop: 10 },
  rowLabel: { flex: 1, gap: 1 },
  label: { fontSize: 13 },
  labelStrong: { fontWeight: "800" },
  detail: { fontSize: 11 },
  // Monospace so the arithmetic column lines up row to row; it reads as a
  // calculation rather than as more prose.
  math: { fontSize: 12, fontFamily: "monospace" },
  value: { fontSize: 15, fontWeight: "700", minWidth: 40, textAlign: "right" },
  valueStrong: { fontSize: 20, fontWeight: "900" },
  note: { fontSize: 11, lineHeight: 16, borderTopWidth: 1, paddingTop: 8 },
  rulesDivider: { borderTopWidth: 1, paddingTop: 12, gap: 8 },
  rulesHeading: { fontSize: 14, fontWeight: "800" },
  rulesBlock: { gap: 6 },
  rulesIntro: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  rule: { fontSize: 13, lineHeight: 19 },
  button: { paddingVertical: 12, borderRadius: 999, alignItems: "center", marginTop: 16 },
  buttonText: { fontWeight: "700" },
});
