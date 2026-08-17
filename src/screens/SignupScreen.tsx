import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import {
  MAX_DISPLAY_NAME_LENGTH,
  isDisplayNameTaken,
  suggestUniqueDisplayName,
} from "../supabase/players-repository";
import { PasswordInput } from "../components/PasswordInput";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { signUpNewUser } = useAuth();
  const navigation = useNavigation<Nav>();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [avatarSeed, setAvatarSeed] = useState("");
  const [useRandomAvatar, setUseRandomAvatar] = useState(false);

  const [nameError, setNameError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const avatarUrl = useMemo(() => {
    const seed = useRandomAvatar ? avatarSeed : displayName || "guest";
    return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
  }, [useRandomAvatar, avatarSeed, displayName]);

  const randomizeAvatar = () => {
    setUseRandomAvatar(true);
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  const checkNameAvailability = async (name: string) => {
    if (!name || name.length < 3) return;
    setIsChecking(true);
    setNameError(null);
    try {
      const taken = await isDisplayNameTaken(name);
      if (taken) {
        const suggestion = await suggestUniqueDisplayName(name);
        setNameError(
          t("username_taken_suggestion", {
            suggestion,
            defaultValue: `Name taken. Try: ${suggestion}`,
          }),
        );
      }
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (!displayName) {
      setError(t("username_required", { defaultValue: "Display name is required" }));
      return;
    }
    if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
      setError(
        t("username_too_long", {
          defaultValue: `Display name must be ${MAX_DISPLAY_NAME_LENGTH} chars or less`,
          length: MAX_DISPLAY_NAME_LENGTH,
        }),
      );
      return;
    }
    if (nameError) return;

    if (!email.trim()) {
      setError(t("email_required", { defaultValue: "Email is required" }));
      return;
    }
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError(t("invalid_email", { defaultValue: "Please enter a valid email address" }));
      return;
    }

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
      const taken = await isDisplayNameTaken(displayName);
      if (taken) {
        setLoading(false);
        const suggestion = await suggestUniqueDisplayName(displayName);
        setNameError(t("username_taken", { defaultValue: `Taken. Try: ${suggestion}` }));
        return;
      }

      const result = await signUpNewUser(email, password, displayName, avatarUrl);
      if (!result.success) {
        setError(result.error || t("signup_failed", { defaultValue: "Signup failed" }));
      } else if (result.checkEmail) {
        setSuccessMessage(
          t("check_email_confirmation", {
            defaultValue:
              "Registration successful! We've sent a confirmation link to your email. Please check your inbox (and spam folder).",
          }),
        );
      } else {
        navigation.navigate("Main", { screen: "Home" });
      }
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  if (successMessage) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, styles.successTitle]}>
          {t("success", { defaultValue: "Success!" })}
        </Text>
        <Text style={{ color: colors.text, textAlign: "center", marginBottom: 24 }}>
          {successMessage}
        </Text>
        <Pressable onPress={() => navigation.navigate("Signin")}>
          <Text style={styles.link}>{t("go_to_signin", { defaultValue: "Go to Sign In" })}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {t("sign_up", { defaultValue: "Sign up" })}
      </Text>

      <View style={styles.row}>
        <Text style={{ color: colors.textMuted }}>
          {t("has_account", { defaultValue: "Already have an account?" })}{" "}
        </Text>
        <Pressable onPress={() => navigation.navigate("Signin")}>
          <Text style={styles.link}>{t("sign_in", { defaultValue: "Sign in" })}</Text>
        </Pressable>
      </View>

      <View style={styles.avatarSection}>
        <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        <Pressable onPress={randomizeAvatar}>
          <Text style={styles.link}>{t("randomize_avatar", { defaultValue: "Randomize" })}</Text>
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t("display_name", { defaultValue: "Display Name" })}
        </Text>
        <TextInput
          value={displayName}
          onChangeText={(value) => {
            setDisplayName(value);
            setUseRandomAvatar(false);
            setNameError(null);
          }}
          onBlur={() => checkNameAvailability(displayName)}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          placeholder={t("display_name_placeholder", { defaultValue: "e.g. WordMaster" }) as string}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            { borderColor: nameError ? "#ef4444" : colors.border, color: colors.text },
          ]}
        />
        {displayName.length === MAX_DISPLAY_NAME_LENGTH && (
          <Text style={styles.warning}>
            {t("username_max_length", {
              defaultValue: `Maximum ${MAX_DISPLAY_NAME_LENGTH} characters allowed`,
              length: MAX_DISPLAY_NAME_LENGTH,
            })}
          </Text>
        )}
        {isChecking && <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t("checking_availability", { defaultValue: "Checking availability..." })}</Text>}
        {nameError && <Text style={styles.error}>{nameError}</Text>}
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
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {t("password_min_length_hint", {
            defaultValue: `Must be at least ${MIN_PASSWORD_LENGTH} characters`,
            length: MIN_PASSWORD_LENGTH,
          })}
        </Text>
      </View>

      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.text }]}>
          {t("confirm_password", { defaultValue: "Confirm Password" })}
        </Text>
        <PasswordInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder={t("confirm_password_placeholder", { defaultValue: "Re-enter your password" }) as string}
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
          <Text style={styles.primaryButtonText}>{t("sign_up", { defaultValue: "Sign Up" })}</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 16, maxWidth: 420, width: "100%", alignSelf: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700" },
  successTitle: { color: "#16a34a" },
  row: { flexDirection: "row", flexWrap: "wrap" },
  link: { color: "#3b82f6" },
  avatarSection: { alignItems: "center", gap: 8 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#e5e7eb" },
  field: { gap: 6 },
  label: { fontSize: 14, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  error: { color: "#ef4444", fontSize: 12 },
  warning: { color: "#ea580c", fontSize: 12 },
  hint: { fontSize: 12 },
  button: { borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  primaryButton: { backgroundColor: "#2563eb" },
  primaryButtonText: { color: "#ffffff", fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
