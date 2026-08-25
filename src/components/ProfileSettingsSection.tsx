import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import Toggle from "./Toggle";
import OptionButton from "./OptionButton";
import Card from "./ui/Card";
import Button from "./ui/Button";

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

  return (
    <>
      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.accent }]}>{t("language", { defaultValue: "Language" })}</Text>
        <View style={styles.row}>
          <OptionButton active={currentLanguage === "en"} onPress={() => onLanguageChange("en")}>
            English
          </OptionButton>
          <OptionButton active={currentLanguage.startsWith("sv")} onPress={() => onLanguageChange("sv")}>
            Svenska
          </OptionButton>
          <OptionButton active={currentLanguage.startsWith("fr")} onPress={() => onLanguageChange("fr")}>
            Français
          </OptionButton>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.accent }]}>{t("theme", { defaultValue: "Theme" })}</Text>
        <View style={styles.row}>
          <OptionButton active={theme === "light"} onPress={() => onThemeChange("light")}>
            🌞 {t("light", { defaultValue: "Light" })}
          </OptionButton>
          <OptionButton active={theme === "dark"} onPress={() => onThemeChange("dark")}>
            🌙 {t("dark", { defaultValue: "Dark" })}
          </OptionButton>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.accent }]}>{t("accessibility", { defaultValue: "Accessibility" })}</Text>
        <Toggle checked={reduceMotion} onChange={onReduceMotionChange} label={t("reduce_motion", { defaultValue: "Reduce Motion" })} />
      </Card>

      <View style={styles.footer}>
        {authState !== "registered" && (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            * {t("settings_guest_note", { defaultValue: "Settings are saved on this device unless you log in." })}
          </Text>
        )}

        <View style={styles.buttonRow}>
          <Button
            size="sm"
            disabled={loading || !canSave}
            label={
              loading
                ? t("saving", { defaultValue: "Saving..." })
                : canSave
                  ? t("save_settings", { defaultValue: "Save Settings" })
                  : t("settings_saved", { defaultValue: "Settings Saved!" })
            }
            onPress={onSave}
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={loading || !canSave}
            label={t("cancel", { defaultValue: "Cancel" })}
            onPress={onCancel}
          />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  footer: { gap: 14 },
  note: { fontSize: 15, fontStyle: "italic" },
  buttonRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
});
