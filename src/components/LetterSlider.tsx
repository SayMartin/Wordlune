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
  showHintToggle?: boolean;
  hintChecked?: boolean;
  onHintChange?: (checked: boolean) => void;
  hintLabel?: string;
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
  showHintToggle,
  hintChecked,
  onHintChange,
  hintLabel,
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

      <View style={styles.toggles}>
        {onOverrideChange && (
          <Toggle
            checked={!!overrideChecked}
            onChange={onOverrideChange}
            disabled={checkboxDisabled}
            label={overrideLabel ? `🔒 ${overrideLabel}` : undefined}
          />
        )}
        {showHintToggle && onHintChange && (
          <Toggle
            checked={!!hintChecked}
            onChange={onHintChange}
            label={hintLabel ? `💡 ${hintLabel}` : undefined}
          />
        )}
      </View>

      {hintChecked && !!hintNames?.length && (
        <Text style={[styles.hint, { color: "#f59e0b" }]}>
          💡 {t("hint_categories", { defaultValue: "Hint" })}: {hintNames.join(", ")}
        </Text>
      )}
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
  toggles: { flexDirection: "row", gap: 20, marginTop: 4 },
  hint: { fontSize: 13, fontWeight: "700", marginTop: 2 },
});
