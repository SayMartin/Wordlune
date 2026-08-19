import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import Slider from "@react-native-community/slider";
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

  return (
    <View style={styles.container}>
      <Text style={[styles.summary, { color: colors.text }]}>
        {minValue} &lt; {label} ≤ {value}
        {count !== undefined && count !== null ? `  (${count})` : ""}
      </Text>

      <View style={styles.sliderRow}>
        <Text style={[styles.sliderCaption, { color: colors.textMuted }]}>Min</Text>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={minValue}
          disabled={disabled}
          minimumTrackTintColor="#2563eb"
          maximumTrackTintColor={colors.border}
          onValueChange={(v) => onChange(Math.min(v, value - 1), value)}
        />
        <Text style={[styles.sliderCaption, styles.sliderCaptionRight, { color: colors.textMuted }]}>Max</Text>
        <Slider
          style={styles.slider}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={value}
          disabled={disabled}
          minimumTrackTintColor="#2563eb"
          maximumTrackTintColor={colors.border}
          onValueChange={(v) => onChange(minValue, Math.max(v, minValue + 1))}
        />
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
  summary: { fontSize: 14, fontWeight: "600" },
  sliderRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sliderCaption: { width: 26, fontSize: 12 },
  sliderCaptionRight: { textAlign: "right" },
  slider: { flex: 1, height: 32 },
  toggles: { flexDirection: "row", gap: 20, marginTop: 4 },
  hint: { fontSize: 13, fontWeight: "700", marginTop: 2 },
});
