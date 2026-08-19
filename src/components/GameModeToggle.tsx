import React from "react";
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

  return (
    <View style={styles.container}>
      {MODES.map((m) => {
        const isActive = mode === m.key;
        const isDisabled = disabled || !m.available;
        const label = t(m.labelKey, { defaultValue: m.fallback });
        return (
          <Pressable
            key={m.key}
            style={[
              styles.button,
              { borderColor: colors.border },
              isActive && { backgroundColor: colors.surface },
              isDisabled && styles.disabledState,
            ]}
            onPress={() => m.available && onChange(m.key)}
            disabled={isDisabled}
            accessibilityLabel={label}
          >
            <Text style={[styles.icon, { color: colors.text }]}>{m.emoji}</Text>
            {isActive ? (
              <Text style={{ color: colors.text, fontWeight: "700", marginLeft: 6 }}>
                {label}
                {!m.available ? " 🔒" : ""}
              </Text>
            ) : null}
          </Pressable>
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
  button: {
    height: 40,
    minWidth: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  icon: { fontSize: 20, lineHeight: 24 },
  // Shared disabled recipe across the app: uniform opacity fade, no per-button
  // custom disabled color.
  disabledState: { opacity: 0.4 },
});
