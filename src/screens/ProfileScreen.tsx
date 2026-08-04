import React, { useEffect } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import MyProfile from "../components/MyProfile";
import type { AppParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<AppParamList>;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { isAuthenticated, session, loadingInitial } = useAuth();
  const navigation = useNavigation<Nav>();

  useEffect(() => {
    // Signin lives at the root stack, above this tab — `navigate` (not
    // `replace`) is what bubbles up to a parent navigator.
    if (!loadingInitial && !isAuthenticated && !session) {
      navigation.navigate("Signin");
    }
  }, [loadingInitial, isAuthenticated, session, navigation]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <Text style={[styles.title, { color: colors.text }]}>{t("my_profile", { defaultValue: "My Profile" })}</Text>
      <MyProfile />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  title: { fontSize: 22, fontWeight: "800" },
});
