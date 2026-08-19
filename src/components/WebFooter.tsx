import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

// Ported from Wordse's src/components/Footer.tsx — web-only page footer.
export default function WebFooter() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const year = new Date().getFullYear();

  return (
    <View style={[styles.footer, { borderTopColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.textMuted }]}>
        © {year} Wordlune. {t("all_rights_reserved", { defaultValue: "All rights reserved." })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingVertical: 24, borderTopWidth: 1, alignItems: "center" },
  text: { fontSize: 13 },
});
