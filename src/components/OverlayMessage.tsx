import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

interface Props {
  message: string;
  type?: "success" | "error" | "warning" | "info";
  duration?: number;
  onClose?: () => void;
}

const COLORS: Record<NonNullable<Props["type"]>, string> = {
  success: "#16a34a",
  error: "#dc2626",
  warning: "#d97706",
  info: "#334155",
};

export default function OverlayMessage({ message, type = "info", duration = 2000, onClose }: Props) {
  useEffect(() => {
    if (!duration) return;
    const id = setTimeout(() => onClose && onClose(), duration);
    return () => clearTimeout(id);
  }, [duration, onClose]);

  return (
    <View style={styles.wrapper} pointerEvents="none">
      <View style={[styles.toast, { backgroundColor: COLORS[type] }]}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
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
  text: { color: "#ffffff", fontWeight: "700", textAlign: "center" },
});
