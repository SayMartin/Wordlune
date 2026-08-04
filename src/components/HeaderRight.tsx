import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeProvider";
import { updatePlayerSettings } from "../supabase/players-repository";
import type { AppParamList } from "../navigation/types";

// Rendered as headerRight both inside MainTabs (nested) and directly on
// root-stack screens, so it's typed against the merged param list rather
// than either navigator's own — see navigation/types.ts.
type Nav = NativeStackNavigationProp<AppParamList>;

function flagFor(lang: string) {
  const code = lang.split("-")[0];
  if (code.startsWith("sv")) return "🇸🇪";
  if (code.startsWith("en")) return "🇬🇧";
  return "🌐";
}

export default function HeaderRight() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const { authState, profile } = useAuth();
  const lang = i18n.language || "en";

  const toggleLanguage = async () => {
    const nextLang = lang.startsWith("en") ? "sv" : "en";
    await i18n.changeLanguage(nextLang);
    if (authState === "registered" && profile?.id) {
      await updatePlayerSettings(profile.id, { language: nextLang });
    }
  };

  return (
    <View style={styles.container}>
      <Pressable
        onPress={toggleLanguage}
        accessibilityLabel={t("toggle_language", { defaultValue: "Switch Language" })}
        hitSlop={8}
      >
        <Text style={styles.flag}>{flagFor(lang)}</Text>
      </Pressable>

      {authState === "registered" || authState === "guest" ? (
        <Pressable onPress={() => navigation.navigate("Signout")} hitSlop={8}>
          <Text style={[styles.actionText, { color: colors.accent }]}>
            {t("logout", { defaultValue: "Logout" })}
          </Text>
        </Pressable>
      ) : (
        <Pressable onPress={() => navigation.navigate("Signin")} hitSlop={8}>
          <Text style={[styles.actionText, { color: colors.accent }]}>
            {t("login", { defaultValue: "Sign In" })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 14, paddingRight: 16 },
  flag: { fontSize: 20 },
  actionText: { fontWeight: "700", fontSize: 13 },
});
