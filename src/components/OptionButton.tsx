import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface Props {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

// Small pill-style toggle button, shared by ProfileSettingsSection.tsx
// (language/theme pickers) and DuelLobby.tsx (duel language picker).
export default function OptionButton({ active, onPress, children }: Props) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={[
        styles.optionButton,
        {
          borderColor: active ? colors.accent : colors.border,
          // The selected pill used to be a fixed pale indigo, which was
          // invisible against a dark surface. accentSoft tints whatever
          // surface it lands on instead.
          backgroundColor: active ? colors.accentSoft : colors.surfaceHover,
        },
      ]}
    >
      <Text style={{ color: active ? colors.accent : colors.text, fontWeight: "600", fontSize: 13 }}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  optionButton: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
});
