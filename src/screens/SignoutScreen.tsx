import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SignoutScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { logout } = useAuth();
  const navigation = useNavigation<Nav>();

  useEffect(() => {
    let mounted = true;

    const performLogout = async () => {
      const minDelay = new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        await Promise.all([logout(), minDelay]);
      } catch (err) {
        console.error("Error during signout:", err);
        await minDelay;
      } finally {
        if (mounted) {
          navigation.reset({ index: 0, routes: [{ name: "Main" }] });
        }
      }
    };

    performLogout();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.accent} />
      <Text style={{ color: colors.textMuted, marginTop: 16 }}>
        {t("logging_out", { defaultValue: "Logging out..." })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
