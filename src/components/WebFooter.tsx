import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import type { AppParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<AppParamList>;

// Ported from Wordse's src/components/Footer.tsx — web-only page footer.
//
// Rendered by MainTabs *outside* Tab.Navigator, so useNavigation() resolves
// against the root stack — which is where PrivacyPolicy and DeleteAccount live.
export default function WebFooter() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const year = new Date().getFullYear();

  return (
    <View style={[styles.footer, { borderTopColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.textMuted }]}>
        © {year} Wordlune by appfinningar.se. {t("all_rights_reserved", { defaultValue: "All rights reserved." })}
      </Text>
      <View style={styles.linkRow}>
        <Pressable onPress={() => navigation.navigate("PrivacyPolicy")}>
          <Text style={[styles.text, styles.link, { color: colors.accent }]}>
            {t("privacy_policy", { defaultValue: "Privacy Policy" })}
          </Text>
        </Pressable>
        <Text style={[styles.text, { color: colors.textMuted }]}>·</Text>
        <Pressable onPress={() => navigation.navigate("DeleteAccount")}>
          <Text style={[styles.text, styles.link, { color: colors.accent }]}>
            {t("delete_account", { defaultValue: "Delete Account" })}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { paddingVertical: 24, borderTopWidth: 1, alignItems: "center", gap: 8 },
  text: { fontSize: 13 },
  linkRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  link: { fontWeight: "700", textDecorationLine: "underline" },
});
