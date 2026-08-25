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
  const { colors, radii } = useTheme();
  const accent = { danger: colors.danger, warning: colors.warning, info: colors.accent }[variant];

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        {/* Opaque, not the glass surface: a modal with the page showing
            through it reads as a rendering fault, not as depth. */}
        <View style={[styles.card, { backgroundColor: colors.surfaceSolid, borderColor: accent, borderRadius: radii.lg }]}>
          <Text style={[styles.title, { color: accent }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>

          <View style={styles.buttonRow}>
            {onCancel && (
              <Pressable
                style={[styles.button, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}
                onPress={onCancel}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>
                  {cancelText || t("cancel", { defaultValue: "Cancel" })}
                </Text>
              </Pressable>
            )}
            <Pressable style={[styles.button, { backgroundColor: accent }]} onPress={onConfirm}>
              <Text style={{ color: colors.onAccent, fontWeight: "700" }}>
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
  card: { width: "100%", maxWidth: 360, borderWidth: 1, padding: 20 },
  title: { fontSize: 18, fontWeight: "900", textAlign: "center", marginBottom: 6 },
  message: { fontSize: 13, textAlign: "center", marginBottom: 20 },
  buttonRow: { flexDirection: "row", gap: 10 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: "transparent", alignItems: "center" },
});
