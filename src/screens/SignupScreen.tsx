import React, { useEffect, useMemo, useState } from "react";
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
import Avatar, { localAvatarUrl } from "../components/Avatar";
import { useAuth } from "../context/AuthContext";
import {
  MAX_DISPLAY_NAME_LENGTH,
  isDisplayNameTaken,
  suggestUniqueDisplayName,
} from "../supabase/players-repository";
import { PasswordInput } from "../components/PasswordInput";
import { translateAuthError } from "../utils/authErrors";
import { MINIMUM_AGE } from "../constants/privacy";
import type { RootStackParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const MIN_PASSWORD_LENGTH = 8;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { signUpNewUser, authState, profile } = useAuth();
  const navigation = useNavigation<Nav>();

  // A signed-in guest is upgrading in place, not creating a second account —
  // their scores, duels and profile carry over. Worth saying plainly on this
  // screen: the whole reason someone hesitates to sign up is not knowing
  // whether they'll lose what they've done.
  const isUpgrade = authState === "guest";

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

  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);

  // Prefill the guest's existing name so upgrading doesn't look like it's
  // asking them to pick a new identity. Only until they type — the guard stops
  // it clobbering their edit when `profile` refreshes.
  useEffect(() => {
    if (isUpgrade && profile?.display_name && !displayName) {
      setDisplayName(profile.display_name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUpgrade, profile?.display_name]);

  // Keeping your own current name must not count as a collision. Same guard
  // Settings.tsx uses when saving a profile edit.
  const isOwnCurrentName = (name: string) =>
    isUpgrade && !!profile?.display_name && name === profile.display_name;

  const avatarUrl = useMemo(() => {
    const seed = useRandomAvatar ? avatarSeed : displayName || "guest";
    return localAvatarUrl(seed);
  }, [useRandomAvatar, avatarSeed, displayName]);

  const randomizeAvatar = () => {
    setUseRandomAvatar(true);
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  const checkNameAvailability = async (name: string) => {
    if (!name || name.length < 3) return;
    if (isOwnCurrentName(name)) return;
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

    if (!privacyAccepted) {
      setError(
        t("privacy_policy_accept_required", {
          defaultValue: "Please confirm you have read the Privacy Policy",
        }),
      );
      return;
    }
    if (!ageConfirmed) {
      setError(
        t("privacy_policy_age_required", {
          age: MINIMUM_AGE,
          defaultValue: "You must be at least {{age}} to create an account",
        }),
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const taken = isOwnCurrentName(displayName)
        ? false
        : await isDisplayNameTaken(displayName);
      if (taken) {
        setLoading(false);
        const suggestion = await suggestUniqueDisplayName(displayName);
        setNameError(t("username_taken", { defaultValue: `Taken. Try: ${suggestion}` }));
        return;
      }

      const result = await signUpNewUser(email, password, displayName, avatarUrl);
      if (!result.success) {
        setError(translateAuthError(t, result.errorCode, result.error, "signup_failed", "Signup failed"));
      } else if (result.checkEmail) {
        setSuccessMessage(
          result.upgraded
            ? t("upgrade_check_email", {
                defaultValue:
                  "Almost there! We've sent a confirmation link to your email — click it to finish turning this into a full account. Your scores and history are already safe, and you can keep playing in the meantime.",
              })
            : t("check_email_confirmation", {
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
        {/* After an upgrade the player is still signed in on their (as yet
            unconfirmed) guest session and can carry on playing — sending them
            to a login form would be both pointless and alarming. */}
        {isUpgrade ? (
          <Pressable onPress={() => navigation.navigate("Main", { screen: "Home" })}>
            <Text style={styles.link}>{t("keep_playing", { defaultValue: "Keep playing" })}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => navigation.navigate("Login")}>
            <Text style={styles.link}>{t("go_to_signin", { defaultValue: "Go to Sign In" })}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <PageScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.container}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {isUpgrade
          ? t("upgrade_account_title", { defaultValue: "Create your account" })
          : t("signup", { defaultValue: "Sign Up" })}
      </Text>

      {isUpgrade ? (
        <View style={[styles.upgradeNotice, { borderColor: "#16a34a55", backgroundColor: colors.surface }]}>
          <Text style={[styles.upgradeText, { color: colors.text }]}>
            {t("upgrade_guest_notice", {
              defaultValue:
                "You're playing as a guest. Signing up keeps everything you've already done — your scores, duels and history all carry over to the new account.",
            })}
          </Text>
        </View>
      ) : (
        <View style={styles.row}>
          <Text style={{ color: colors.textMuted }}>
            {t("has_account", { defaultValue: "Already have an account?" })}{" "}
          </Text>
          <Pressable onPress={() => navigation.navigate("Login")}>
            <Text style={styles.link}>{t("login", { defaultValue: "Log In" })}</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.avatarSection}>
        <Avatar uri={avatarUrl} fallbackSeed={displayName} size={96} />
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

      {/* Both start unticked — a pre-ticked box is not a valid acknowledgement,
          and reads as sharp practice even where consent isn't the legal basis.
          Note these are acknowledgements, not consent: the basis for the
          account itself is contract (Art. 6(1)(b)), so asking permission to
          process would misrepresent what's happening. */}
      <View style={styles.consentGroup}>
        <Checkbox
          checked={privacyAccepted}
          onToggle={() => setPrivacyAccepted((v) => !v)}
          colors={colors}
          label={t("privacy_policy_accept_label", {
            defaultValue: "I have read and accept the Privacy Policy",
          })}
        />
        <Checkbox
          checked={ageConfirmed}
          onToggle={() => setAgeConfirmed((v) => !v)}
          colors={colors}
          label={t("privacy_policy_age_label", {
            age: MINIMUM_AGE,
            defaultValue: "I am {{age}} years old or older",
          })}
        />
        {/* Separate line rather than a link nested inside the checkbox label:
            a tappable Text inside a Pressable makes it ambiguous whether a tap
            opens the policy or toggles the box, and word order varies enough
            across en/sv/fr that an inline link is awkward to translate. */}
        <Pressable onPress={() => navigation.navigate("PrivacyPolicy")}>
          <Text style={[styles.link, styles.consentLink]}>
            {t("privacy_policy_read_link", { defaultValue: "Read the Privacy Policy" })}
          </Text>
        </Pressable>
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
          <Text style={styles.primaryButtonText}>{t("signup", { defaultValue: "Sign Up" })}</Text>
        )}
      </Pressable>
    </PageScrollView>
  );
}

function Checkbox({
  checked,
  onToggle,
  label,
  colors,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  colors: { text: string; border: string; accent: string };
}) {
  return (
    <Pressable
      style={styles.checkRow}
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      // 48dp minimum touch target without inflating the row, same approach as
      // LetterSlider's stepper buttons.
      hitSlop={6}
    >
      <View
        style={[
          styles.checkbox,
          { borderColor: checked ? colors.accent : colors.border },
          checked && { backgroundColor: colors.accent },
        ]}
      >
        {checked && <Text style={styles.checkMark}>✓</Text>}
      </View>
      <Text style={[styles.checkLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 16, maxWidth: 420, width: "100%", alignSelf: "center" },
  upgradeNotice: { borderWidth: 1, borderRadius: 10, padding: 12 },
  upgradeText: { fontSize: 13, lineHeight: 19 },
  consentGroup: { gap: 12 },
  checkRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkMark: { color: "#ffffff", fontSize: 14, fontWeight: "900", lineHeight: 18 },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
  consentLink: { fontSize: 14, marginLeft: 32 },
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
