import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { OWNER_NAME, OWNER_SITE_LABEL, OWNER_SITE_URL } from "../constants/app";
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
      {/* Nested Text rather than a flex row so the line wraps as one sentence
          on narrow viewports instead of breaking between name and link. */}
      <Text style={[styles.text, { color: colors.textMuted }]}>
        © {year} {OWNER_NAME} ·{" "}
        <Text
          accessibilityRole="link"
          onPress={() => Linking.openURL(OWNER_SITE_URL)}
          style={[styles.siteLink, { color: colors.accent }]}
        >
          {OWNER_SITE_LABEL}
        </Text>
      </Text>
      <Pressable onPress={() => navigation.navigate("PrivacyPolicy")}>
        <Text style={[styles.text, styles.link, { color: colors.accent }]}>
          {t("privacy_policy", { defaultValue: "Privacy Policy" })}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  // Single centred row: copyright on the left of the gap, Privacy Policy on the
  // right, with a wide columnGap holding them apart. `wrap` + rowGap is the
  // safety net rather than the intent — the row fits comfortably at any normal
  // width and only breaks on a very narrow viewport, where stacking reads far
  // better than the text overflowing.
  footer: {
    marginTop: 32,
    paddingVertical: 24,
    borderTopWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    columnGap: 48,
    rowGap: 8,
  },
  text: { fontSize: 13 },
  link: { fontWeight: "600", textDecorationLine: "underline" },
  // Underlined but not bold: the copyright line reads as one quiet sentence,
  // unlike the Privacy/Delete pair below it, which are deliberate call-outs.
  siteLink: { fontSize: 13, textDecorationLine: "underline" },
});
