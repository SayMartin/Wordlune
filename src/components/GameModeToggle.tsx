import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

type Mode = "practice" | "competitive" | "duel";

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}

const MODES: { key: Mode; emoji: string; labelKey: string; fallback: string; available: boolean }[] = [
  { key: "practice", emoji: "☕", labelKey: "practice", fallback: "Practice", available: true },
  { key: "competitive", emoji: "🏆", labelKey: "competitive", fallback: "Competitive", available: true },
  { key: "duel", emoji: "⚔️", labelKey: "duel", fallback: "Duel", available: true },
];

export default function GameModeToggle({ mode, onChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Native has no hover concept — onHoverIn/onHoverOut simply never fire
  // there, so this stays permanently null and the tooltip never renders,
  // which is the desired behavior (touch has no equivalent to hover).
  const [hoveredKey, setHoveredKey] = useState<Mode | null>(null);

  return (
    <View style={styles.container}>
      {MODES.map((m) => {
        const isActive = mode === m.key;
        const isDisabled = disabled || !m.available;
        const label = t(m.labelKey, { defaultValue: m.fallback }) + (!m.available ? " 🔒" : "");
        return (
          <View key={m.key} style={styles.buttonWrapper}>
            {hoveredKey === m.key && (
              <View style={[styles.tooltip, { backgroundColor: colors.text }]} pointerEvents="none">
                <Text style={[styles.tooltipText, { color: colors.background }]}>{label}</Text>
              </View>
            )}
            <Pressable
              style={[
                styles.button,
                { borderColor: colors.border },
                isActive && { backgroundColor: colors.accent, borderColor: colors.accent },
                isDisabled && styles.disabledState,
              ]}
              onPress={() => m.available && onChange(m.key)}
              onHoverIn={() => setHoveredKey(m.key)}
              onHoverOut={() => setHoveredKey(null)}
              disabled={isDisabled}
              accessibilityLabel={label}
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.icon, { color: isActive ? "#ffffff" : colors.text }]}>{m.emoji}</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

// Fixed height (matching CategorySelector's expandButton) instead of
// padding-derived height — emoji glyphs have inconsistent line-box metrics
// across browsers/fonts, so padding math alone doesn't reliably line the two
// controls up.
const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 6,
    flexShrink: 0,
  },
  buttonWrapper: { position: "relative" },
  button: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 2,
  },
  icon: { fontSize: 20, lineHeight: 24 },
  // Shared disabled recipe across the app: uniform opacity fade, no per-button
  // custom disabled color.
  disabledState: { opacity: 0.4 },
  tooltip: {
    position: "absolute",
    bottom: "100%",
    left: "50%",
    // RN's transform doesn't support percentage values, so centering uses a
    // fixed-width tooltip (see minWidth/maxWidth) offset by half of it
    // instead of `translateX(-50%)`.
    marginLeft: -60,
    marginBottom: 6,
    minWidth: 120,
    maxWidth: 120,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    zIndex: 10,
  },
  tooltipText: { fontSize: 12, fontWeight: "600", textAlign: "center" },
});
