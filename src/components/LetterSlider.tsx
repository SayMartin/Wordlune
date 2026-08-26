import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import Toggle from "./Toggle";

interface Props {
  value: number; // max
  minValue: number; // min
  onChange: (min: number, max: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  disabled?: boolean;
  overrideChecked?: boolean;
  onOverrideChange?: (checked: boolean) => void;
  overrideLabel?: string;
  checkboxDisabled?: boolean;
  count?: number | null;
  // Subcategory names the current secret belongs to — shown as a compact
  // line under the toggles instead of requiring CategorySelector to be
  // expanded (there's no room for that there).
  hintNames?: string[];
}

function StepperButton({
  glyph,
  onPress,
  disabled,
}: {
  glyph: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={[styles.stepperButton, { borderColor: colors.border }, disabled && styles.disabledState]}
      onPress={onPress}
      disabled={disabled}
      // Visual size stays compact so the row doesn't get tall, but the tap
      // target still meets Material Design's 48dp minimum touch size.
      hitSlop={8}
    >
      <Text style={{ color: colors.text, fontWeight: "700" }}>{glyph}</Text>
    </Pressable>
  );
}

export default function LetterSlider({
  value,
  minValue,
  onChange,
  min = 2,
  max = 18,
  step = 1,
  label = "Letter range",
  disabled = false,
  overrideChecked,
  onOverrideChange,
  overrideLabel,
  checkboxDisabled = false,
  count,
  hintNames,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const decMin = () => onChange(Math.max(min, minValue - step), value);
  const incMin = () => onChange(Math.min(minValue + step, value - step), value);
  const decMax = () => onChange(minValue, Math.max(value - step, minValue + step));
  const incMax = () => onChange(minValue, Math.min(max, value + step));

  return (
    <View style={styles.container}>
      <View style={styles.summaryRow}>
        <StepperButton glyph="−" onPress={decMin} disabled={disabled || minValue <= min} />
        {/* minValue itself is the exclusive lower bound (word.length > minValue) used
            for filtering, but "1 ≤" reads more naturally than "0 <" — so it's shown
            here as the equivalent inclusive bound (minValue + 1). */}
        <Text style={[styles.summary, { color: colors.text }]}>{minValue + 1}</Text>
        <StepperButton glyph="+" onPress={incMin} disabled={disabled || minValue + step >= value} />
        <Text style={[styles.summary, { color: colors.text }]}>
          {" ≤ "}
          {label}
          {" ≤ "}
        </Text>
        <StepperButton glyph="−" onPress={decMax} disabled={disabled || value - step <= minValue} />
        <Text style={[styles.summary, { color: colors.text }]}>{value}</Text>
        <StepperButton glyph="+" onPress={incMax} disabled={disabled || value >= max} />
        {count !== undefined && count !== null && (
          <Text style={[styles.summary, { color: colors.text }]}>{`  (${count})`}</Text>
        )}
      </View>

      {/* The hint text shares this row with the "Always 5" switch at every
          width, down to a 375px iPhone SE. That is what flexBasis: 0 buys: an
          item whose basis is zero always fits on the line it is on, so the row
          can never decide to wrap it onto its own. When the text is longer than
          the space left beside the switch it wraps inside its own box instead,
          growing the row taller rather than moving. */}
      <View style={styles.toggles}>
        {onOverrideChange && (
          <Toggle
            checked={!!overrideChecked}
            onChange={onOverrideChange}
            disabled={checkboxDisabled}
            label={overrideLabel ? `🔒 ${overrideLabel}` : undefined}
          />
        )}
        {!!hintNames?.length && (
          // The 💡 is back on the text itself now that the switch that used to
          // carry one is gone. The hint is always on: without it the answer is
          // one of a couple of hundred unrelated words and the round is
          // guesswork rather than general knowledge. See createMatch() for the
          // same reasoning on the duel side.
          <Text style={[styles.hint, { color: colors.warning }]}>
            💡 {t("hint_categories", { defaultValue: "Hint" })}: {hintNames.join(", ")}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  summaryRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", rowGap: 4 },
  summary: { fontSize: 14, fontWeight: "600" },
  stepperButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 6,
    marginHorizontal: 8,
  },
  // Shared disabled recipe across the app: uniform opacity fade, no per-button
  // custom disabled color.
  disabledState: { opacity: 0.4 },
  toggles: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    columnGap: 20,
    rowGap: 8,
    marginTop: 4,
  },
  // flexBasis: 0 keeps the hint on the switch's row at any width (see the
  // comment at the call site); flexGrow then hands it whatever is left of the
  // line, which is also what makes textAlign do anything, since it centres the
  // text inside the item's box rather than the row's. minWidth is spelled out
  // because a flex item's automatic minimum size is its content — without it a
  // long category name would push the row wider than the card instead of
  // wrapping inside it.
  //
  // lineHeight is set explicitly because the default for 13px leaves a couple
  // of pixels of slack under the descenders, which reads as extra padding when
  // this is the last thing in the card.
  hint: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 17,
    textAlign: "center",
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
  },
});
