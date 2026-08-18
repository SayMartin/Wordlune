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
      style={[
        styles.optionButton,
        { borderColor: active ? "#4f46e5" : colors.border },
        active && { backgroundColor: "#eef2ff" },
      ]}
    >
      <Text style={{ color: active ? "#4338ca" : colors.text, fontWeight: "600", fontSize: 13 }}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  optionButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
});
