import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

// Ported from Wordse's src/pages/NotFound.tsx — same i18n keys, same
// minimal title+message layout. Reachable on web via any URL that doesn't
// match a configured route (see the "NotFound" linking path in App.tsx);
// on native there's no URL bar to mistype, but the screen stays reachable
// as a stack route for parity/tests.
export default function NotFoundScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t("not_found_title", { defaultValue: "Not Found" })}
      </Text>
      <Text style={[styles.message, { color: colors.textMuted }]}>
        {t("not_found_message", { defaultValue: "The page you're looking for doesn't exist." })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 24, gap: 8 },
  title: { fontSize: 22, fontWeight: "700" },
  message: { fontSize: 14 },
});
