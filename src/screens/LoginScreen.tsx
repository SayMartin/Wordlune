import React, { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import PageScrollView from "../components/PageScrollView";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { localAvatarUrl } from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import { suggestUniqueDisplayName } from "../supabase/players-repository";
import { PasswordInput } from "../components/PasswordInput";
import { translateAuthError } from "../utils/authErrors";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function LoginScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { login, loginAnonymously, requestPasswordReset } = useAuth();
  const navigation = useNavigation<Nav>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setResetError(t("email_required", { defaultValue: "Email is required" }));
      return;
    }
    setResetLoading(true);
    setResetError(null);
    try {
      const result = await requestPasswordReset(email.trim());
      if (!result.success) {
        setResetError(translateAuthError(t, result.errorCode, result.error, "reset_password_failed", "Failed to send reset link"));
      } else {
        setResetSent(true);
      }
    } finally {
      setResetLoading(false);
    }
  };

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
      const avatarUrl = localAvatarUrl(guestName);
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
    <PageScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {t("login", { defaultValue: "Log In" })}
      </Text>

      <View style={styles.row}>
        <Text style={{ color: colors.textMuted }}>
          {t("no_account", { defaultValue: "Don't have an account?" })}{" "}
        </Text>
        <Pressable onPress={() => navigation.navigate("Signup")}>
          <Text style={styles.link}>{t("signup", { defaultValue: "Sign Up" })}</Text>
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
        <Pressable
          onPress={() => {
            setShowForgotPassword((v) => !v);
            setResetSent(false);
            setResetError(null);
          }}
        >
          <Text style={styles.link}>{t("forgot_password", { defaultValue: "Forgot your password?" })}</Text>
        </Pressable>
      </View>

      {showForgotPassword && (
        <View style={[styles.forgotBox, { borderColor: colors.border }]}>
          {resetSent ? (
            <Text style={{ color: colors.text }}>
              {t("reset_password_email_sent", {
                defaultValue: "If an account exists for that email, a password reset link has been sent.",
              })}
            </Text>
          ) : (
            <>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {t("reset_password_instructions", {
                  defaultValue: "Enter your email above, then send yourself a reset link.",
                })}
              </Text>
              {resetError && <Text style={styles.error}>{resetError}</Text>}
              <Pressable
                style={[styles.button, styles.secondaryButton, resetLoading && styles.disabled]}
                onPress={handleForgotPassword}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.secondaryButtonText}>
                    {t("send_reset_link", { defaultValue: "Send Reset Link" })}
                  </Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      )}

      {error && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={[styles.button, styles.primaryButton, loading && styles.disabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.primaryButtonText}>{t("login", { defaultValue: "Log In" })}</Text>
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

      {/* Same notice as SessionGate's guest button — a guest sign-in creates a
          real account, so the policy must be reachable at that moment too. */}
      <View style={styles.guestNoticeRow}>
        <Text style={[styles.guestNotice, { color: colors.textMuted }]}>
          {t("privacy_policy_guest_notice", { defaultValue: "By continuing you accept our" })}{" "}
        </Text>
        <Text
          accessibilityRole="link"
          onPress={() => navigation.navigate("PrivacyPolicy")}
          style={[styles.guestNotice, styles.guestNoticeLink, { color: colors.accent }]}
        >
          {t("privacy_policy", { defaultValue: "Privacy Policy" })}
        </Text>
      </View>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 16, maxWidth: 420, width: "100%", alignSelf: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  row: { flexDirection: "row", flexWrap: "wrap" },
  link: { color: "#3b82f6" },
  field: { gap: 6 },
  guestNoticeRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  guestNotice: { fontSize: 12, lineHeight: 17 },
  guestNoticeLink: { fontWeight: "700", textDecorationLine: "underline" },
  forgotBox: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 10 },
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
