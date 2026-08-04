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
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {MODES.map((m) => {
        const isActive = mode === m.key;
        const isDisabled = disabled || !m.available;
        return (
          <Pressable
            key={m.key}
            style={[styles.button, isActive && { backgroundColor: colors.background }]}
            onPress={() => m.available && onChange(m.key)}
            disabled={isDisabled}
          >
            <Text style={{ color: isDisabled ? colors.textMuted : colors.text, fontWeight: isActive ? "700" : "500" }}>
              {m.emoji} {t(m.labelKey, { defaultValue: m.fallback })}
              {!m.available ? " 🔒" : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 10,
    padding: 4,
    gap: 4,
  },
  button: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8 },
});
