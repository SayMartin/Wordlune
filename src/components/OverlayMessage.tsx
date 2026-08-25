import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

interface Props {
  message: string;
  type?: "success" | "error" | "warning" | "info";
  duration?: number;
  onClose?: () => void;
}

export default function OverlayMessage({ message, type = "info", duration = 2000, onClose }: Props) {
  const { colors } = useTheme();
  // Read from the palette rather than a module-level table so the toast
  // follows a theme switch — the old constants were tuned for light mode and
  // sat almost invisibly on the dark background.
  const backgrounds: Record<NonNullable<Props["type"]>, string> = {
    success: colors.success,
    error: colors.danger,
    warning: colors.warning,
    info: colors.accent,
  };

  useEffect(() => {
    if (!duration) return;
    const id = setTimeout(() => onClose && onClose(), duration);
    return () => clearTimeout(id);
  }, [duration, onClose]);

  return (
    <View style={styles.wrapper}>
      <View style={[styles.toast, { backgroundColor: backgrounds[type] }]}>
        <Text style={[styles.text, { color: colors.onAccent }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    pointerEvents: "none",
    position: "absolute",
    top: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 100,
  },
  toast: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    maxWidth: "90%",
  },
  text: { fontWeight: "700", textAlign: "center" },
});
