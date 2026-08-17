import React from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import MyProfile from "../components/MyProfile";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t("settings", { defaultValue: "Settings" })}</Text>
      <MyProfile />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "800" },
});
