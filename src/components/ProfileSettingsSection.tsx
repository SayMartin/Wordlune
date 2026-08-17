import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import Toggle from "./Toggle";

interface Props {
  currentLanguage: string;
  onLanguageChange: (lang: string) => void;
  theme: "light" | "dark";
  onThemeChange: (theme: "light" | "dark") => void;
  reduceMotion: boolean;
  onReduceMotionChange: () => void;
  authState: string;
  loading: boolean;
  canSave: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export default function ProfileSettingsSection({
  currentLanguage,
  onLanguageChange,
  theme,
  onThemeChange,
  reduceMotion,
  onReduceMotionChange,
  authState,
  loading,
  canSave,
  onSave,
  onCancel,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const OptionButton = ({
    active,
    onPress,
    children,
  }: {
    active: boolean;
    onPress: () => void;
    children: React.ReactNode;
  }) => (
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

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: "#6366f1" }]}>{t("language", { defaultValue: "Language" })}</Text>
        <View style={styles.row}>
          <OptionButton active={currentLanguage === "en"} onPress={() => onLanguageChange("en")}>
            English
          </OptionButton>
          <OptionButton active={currentLanguage.startsWith("sv")} onPress={() => onLanguageChange("sv")}>
            Svenska
          </OptionButton>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: "#6366f1" }]}>{t("theme", { defaultValue: "Theme" })}</Text>
        <View style={styles.row}>
          <OptionButton active={theme === "light"} onPress={() => onThemeChange("light")}>
            🌞 {t("light", { defaultValue: "Light" })}
          </OptionButton>
          <OptionButton active={theme === "dark"} onPress={() => onThemeChange("dark")}>
            🌙 {t("dark", { defaultValue: "Dark" })}
          </OptionButton>
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: "#6366f1" }]}>{t("accessibility", { defaultValue: "Accessibility" })}</Text>
        <Toggle checked={reduceMotion} onChange={onReduceMotionChange} label={t("reduce_motion", { defaultValue: "Reduce Motion" })} />
      </View>

      <View style={styles.footer}>
        {authState !== "registered" && (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            * {t("settings_guest_note", { defaultValue: "Settings are saved on this device unless you log in." })}
          </Text>
        )}

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.saveButton, (loading || !canSave) && styles.disabled]}
            onPress={onSave}
            disabled={loading || !canSave}
          >
            <Text style={styles.saveButtonText}>
              {loading
                ? t("saving", { defaultValue: "Saving..." })
                : canSave
                  ? t("save_settings", { defaultValue: "Save Settings" })
                  : t("settings_saved", { defaultValue: "Settings Saved!" })}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.cancelButton, (loading || !canSave) && styles.disabled]}
            onPress={onCancel}
            disabled={loading || !canSave}
          >
            <Text style={styles.cancelButtonText}>{t("cancel", { defaultValue: "Cancel" })}</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8 },
  optionButton: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  footer: { gap: 14 },
  note: { fontSize: 15, fontStyle: "italic" },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  saveButton: { backgroundColor: "#2563eb", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  disabled: { opacity: 0.5 },
  saveButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  cancelButton: { backgroundColor: "#6b7280", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  cancelButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
});
