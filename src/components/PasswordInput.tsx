import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface PasswordInputProps extends Omit<TextInputProps, "secureTextEntry"> {}

export function PasswordInput({ style, ...props }: PasswordInputProps) {
  const { colors } = useTheme();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View style={styles.wrapper}>
      <TextInput
        secureTextEntry={!showPassword}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          { borderColor: colors.border, color: colors.text },
          style,
        ]}
        {...props}
      />
      <Pressable
        style={styles.toggle}
        onPress={() => setShowPassword((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={showPassword ? "Hide password" : "Show password"}
      >
        <Text style={{ color: colors.textMuted }}>{showPassword ? "🙈" : "👁️"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: "relative", justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    paddingRight: 44,
  },
  toggle: {
    position: "absolute",
    right: 8,
    height: "100%",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
});

export default PasswordInput;
