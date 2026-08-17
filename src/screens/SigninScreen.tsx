import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { suggestUniqueDisplayName } from "../supabase/players-repository";
import { PasswordInput } from "../components/PasswordInput";
import { translateAuthError } from "../utils/authErrors";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SigninScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { login, loginAnonymously } = useAuth();
  const navigation = useNavigation<Nav>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await login(email, password);
      if (!result || !result.success) {
        setError(translateAuthError(t, result?.errorCode, result?.error, "signin_failed", "Sign in failed"));
      } else {
        navigation.navigate("Main", { screen: "Home" });
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const guestName = await suggestUniqueDisplayName("Guest");
      const avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(guestName)}`;
      const result = await loginAnonymously(guestName, avatarUrl);
      if (!result || !result.success) {
        setError(translateAuthError(t, result?.errorCode, result?.error, "guest_login_failed", "Guest login failed"));
      } else {
        navigation.navigate("Main", { screen: "Home" });
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {t("sign_in", { defaultValue: "Sign In" })}
      </Text>

      <View style={styles.row}>
        <Text style={{ color: colors.textMuted }}>
          {t("no_account", { defaultValue: "Don't have an account?" })}{" "}
        </Text>
        <Pressable onPress={() => navigation.navigate("Signup")}>
          <Text style={styles.link}>{t("sign_up", { defaultValue: "Sign up" })}</Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t("email", { defaultValue: "Email" })}
        </Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder={t("email_placeholder", { defaultValue: "email" }) as string}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          keyboardType="email-address"
          style={[styles.input, { borderColor: colors.border, color: colors.text }]}
        />
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t("password", { defaultValue: "Password" })}
        </Text>
        <PasswordInput
          value={password}
          onChangeText={setPassword}
          placeholder={t("password_placeholder", { defaultValue: "Enter your password" }) as string}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, styles.primaryButton, loading && styles.disabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.primaryButtonText}>{t("sign_in", { defaultValue: "Sign In" })}</Text>
        )}
      </Pressable>

      <View style={styles.dividerRow}>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={{ color: colors.textMuted }}>{t("or", { defaultValue: "Or" })}</Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      </View>

      <Pressable
        style={[styles.button, styles.secondaryButton, loading && styles.disabled]}
        onPress={handleGuestLogin}
        disabled={loading}
      >
        <Text style={styles.secondaryButtonText}>
          {t("play_as_guest", { defaultValue: "Play as Guest" })}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 16, maxWidth: 420, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  row: { flexDirection: "row", flexWrap: "wrap" },
  link: { color: "#3b82f6" },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  error: { color: "#ef4444", fontSize: 14 },
  button: { borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  primaryButton: { backgroundColor: "#2563eb" },
  primaryButtonText: { color: "#ffffff", fontWeight: "600" },
  secondaryButton: { backgroundColor: "#4b5563" },
  secondaryButtonText: { color: "#ffffff", fontWeight: "600" },
  disabled: { opacity: 0.5 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { flex: 1, height: 1 },
});
