import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import PageScrollView from "../components/PageScrollView";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { PageTitle } from "../components/ui/Heading";
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
    <PageScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
      <PageTitle>{t("login", { defaultValue: "Log In" })}</PageTitle>

      <View style={styles.row}>
        <Text style={{ color: colors.textMuted }}>
          {t("no_account", { defaultValue: "Don't have an account?" })}{" "}
        </Text>
        <Pressable onPress={() => navigation.navigate("Signup")}>
          <Text style={[styles.link, { color: colors.accent }]}>
            {t("signup", { defaultValue: "Sign Up" })}
          </Text>
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
          style={[
            styles.input,
            { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceSunken },
          ]}
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
          <Text style={[styles.link, { color: colors.accent }]}>
            {t("forgot_password", { defaultValue: "Forgot your password?" })}
          </Text>
        </Pressable>
      </View>

      {showForgotPassword && (
        <View style={[styles.forgotBox, { borderColor: colors.border, backgroundColor: colors.surfaceSunken }]}>
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
              {resetError && <Text style={[styles.error, { color: colors.danger }]}>{resetError}</Text>}
              <Button
                variant="ghost"
                fullWidth
                loading={resetLoading}
                label={t("send_reset_link", { defaultValue: "Send Reset Link" })}
                onPress={handleForgotPassword}
              />
            </>
          )}
        </View>
      )}

      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      <Button
        fullWidth
        loading={loading}
        label={t("login", { defaultValue: "Log In" })}
        onPress={handleSubmit}
      />

      <View style={styles.dividerRow}>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <Text style={{ color: colors.textMuted }}>{t("or", { defaultValue: "Or" })}</Text>
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
      </View>

      <Button
        variant="ghost"
        fullWidth
        disabled={loading}
        label={t("play_as_guest", { defaultValue: "Play as Guest" })}
        onPress={handleGuestLogin}
      />

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
      </Card>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 40, paddingBottom: 48, maxWidth: 460, width: "100%", alignSelf: "center" },
  card: { padding: 24, gap: 16 },
  row: { flexDirection: "row", flexWrap: "wrap" },
  link: { fontWeight: "600" },
  field: { gap: 6 },
  guestNoticeRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  guestNotice: { fontSize: 12, lineHeight: 17 },
  guestNoticeLink: { fontWeight: "700", textDecorationLine: "underline" },
  forgotBox: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 10 },
  label: { fontSize: 14, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  error: { fontSize: 14 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  divider: { flex: 1, height: 1 },
});
