import React from "react";
import { StyleSheet, Text } from "react-native";
import PageScrollView from "../components/PageScrollView";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import Settings from "../components/Settings";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <PageScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t("settings", { defaultValue: "Settings" })}</Text>
      <Settings />
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "800" },
});
