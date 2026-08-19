import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export default function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <Switch
        value={checked}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: "#2563eb", false: colors.border }}
      />
      {label && (
        <Text style={[styles.label, { color: colors.text, opacity: disabled ? 0.4 : 1 }]}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 13, fontWeight: "500" },
});
