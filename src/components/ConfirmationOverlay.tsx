import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

interface Props {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

const VARIANT_COLORS: Record<NonNullable<Props["variant"]>, string> = {
  danger: "#dc2626",
  warning: "#ea580c",
  info: "#1f2937",
};

export default function ConfirmationOverlay({
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
  cancelText,
  variant = "warning",
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const accent = VARIANT_COLORS[variant];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: accent }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

          <View style={styles.buttonRow}>
            {onCancel && (
              <Pressable style={[styles.button, { backgroundColor: colors.background }]} onPress={onCancel}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {cancelText || t("cancel", { defaultValue: "Cancel" })}
                </Text>
              </Pressable>
            )}
            <Pressable style={[styles.button, { backgroundColor: accent }]} onPress={onConfirm}>
              <Text style={{ color: "#ffffff", fontWeight: "700" }}>
                {confirmText || t("confirm", { defaultValue: "Confirm" })}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 360, borderRadius: 16, borderWidth: 2, padding: 20 },
  title: { fontSize: 18, fontWeight: "900", textAlign: "center", marginBottom: 6 },
  message: { fontSize: 13, textAlign: "center", marginBottom: 20 },
  buttonRow: { flexDirection: "row", gap: 10 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
});
