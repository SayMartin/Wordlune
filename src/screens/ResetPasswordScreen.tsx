import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import PageScrollView from "../components/PageScrollView";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import { PageTitle } from "../components/ui/Heading";
import { useAuth } from "../context/AuthContext";
import { PasswordInput } from "../components/PasswordInput";
import { translateAuthError } from "../utils/authErrors";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MIN_PASSWORD_LENGTH = 8;

// Landing page for the link sent by requestPasswordReset() (AuthContext.tsx).
// Clicking that link authenticates the browser with a recovery session
// (picked up automatically via supabaseClient's detectSessionInUrl), which
// is enough for updatePassword() to succeed without knowing the old password.
export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { updatePassword } = useAuth();
  const navigation = useNavigation<Nav>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(
        t("password_too_short", {
          defaultValue: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
          length: MIN_PASSWORD_LENGTH,
        }),
      );
      return;
    }
    if (password !== confirmPassword) {
      setError(t("passwords_do_not_match", { defaultValue: "Passwords do not match" }));
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await updatePassword(password);
      if (!result.success) {
        setError(translateAuthError(t, result.errorCode, result.error, "update_password_failed", "Failed to update password"));
      } else {
        setDone(true);
      }
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <PageScrollView contentContainerStyle={[styles.container, styles.center]}>
        <Text style={[styles.title, { color: colors.success }]}>
          {t("password_updated", { defaultValue: "Password Updated!" })}
        </Text>
        <Text style={{ color: colors.text, textAlign: "center", marginBottom: 24 }}>
          {t("password_updated_msg", { defaultValue: "Your password has been changed. You can now log in with it." })}
        </Text>
        <Pressable onPress={() => navigation.navigate("Login")}>
          <Text style={[styles.link, { color: colors.accent }]}>
            {t("go_to_signin", { defaultValue: "Go to Log In" })}
          </Text>
        </Pressable>
      </PageScrollView>
    );
  }

  return (
    <PageScrollView contentContainerStyle={styles.container}>
      <Card style={styles.card}>
      <PageTitle>{t("reset_password", { defaultValue: "Reset Password" })}</PageTitle>

      <Text style={{ color: colors.textMuted }}>
        {t("reset_password_new_prompt", { defaultValue: "Choose a new password for your account." })}
      </Text>

      <PasswordInput
        value={password}
        onChangeText={setPassword}
        placeholder={t("password_placeholder", { defaultValue: "Enter your password" }) as string}
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {t("password_min_length_hint", {
          defaultValue: `Must be at least ${MIN_PASSWORD_LENGTH} characters`,
          length: MIN_PASSWORD_LENGTH,
        })}
      </Text>

      <PasswordInput
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder={t("confirm_password_placeholder", { defaultValue: "Re-enter your password" }) as string}
      />

      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

      <Button
        fullWidth
        loading={loading}
        label={t("update_password", { defaultValue: "Update Password" })}
        onPress={handleSubmit}
      />
      </Card>
    </PageScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingTop: 40, paddingBottom: 48, maxWidth: 460, width: "100%", alignSelf: "center" },
  card: { padding: 24, gap: 16 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  link: { fontWeight: "600" },
  hint: { fontSize: 12 },
  error: { fontSize: 14 },
});
