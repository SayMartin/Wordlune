import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { updatePlayerSettings } from "../supabase/players-repository";
import { flagFor, nextLanguage } from "../utils/languageCycle";
import Logo from "./Logo";
import type { AppParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<AppParamList>;

// Native's per-screen header equivalent of WebTopNav's brand+flag cluster
// (logo, then language flag right next to it) — kept in sync with web so the
// flag sits in the same spot on every platform instead of next to the
// greeting/logout controls like it used to on native (see HeaderRight.tsx).
export default function HeaderLeft() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<Nav>();
  const { authState, profile } = useAuth();
  const lang = i18n.language || "en";

  const toggleLanguage = async () => {
    const nextLang = nextLanguage(lang);
    await i18n.changeLanguage(nextLang);
    if (authState === "registered" && profile?.id) {
      await updatePlayerSettings(profile.id, { language: nextLang });
    }
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={() => navigation.navigate("Home")}>
        <Logo size={28} />
      </Pressable>
      <Pressable
        onPress={toggleLanguage}
        accessibilityLabel={t("toggle_language", { defaultValue: "Switch Language" })}
        hitSlop={8}
      >
        <Text style={styles.flag}>{flagFor(lang)}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 10, paddingLeft: 16 },
  flag: { fontSize: 20 },
});
