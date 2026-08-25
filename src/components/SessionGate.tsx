import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { localAvatarUrl } from "./Avatar";
import { useAuth } from "../context/AuthContext";
import { suggestUniqueDisplayName } from "../supabase/players-repository";
import Card from "./ui/Card";
import Button from "./ui/Button";
import WavingHand from "./WavingHand";
import type { AppParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<AppParamList>;

// Mirrors Wordse's SessionRequiredRoute — gates a screen behind at least a
// guest session, with an inline choice to play as guest or go sign in,
// rather than silently allowing visitor access or hard-redirecting away.
export default function SessionGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session, authState, loginAnonymously } = useAuth();
  const navigation = useNavigation<Nav>();
  const [signingIn, setSigningIn] = useState(false);

  if (session === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (authState === "visitor") {
    const handleGuestLogin = async () => {
      setSigningIn(true);
      // player_profiles.display_name is NOT NULL — loginAnonymously() with no
      // args leaves it null (from raw_user_meta_data->>'full_name') and the
      // creation trigger 500s. Generate a guest name first, matching
      // LoginScreen's handleGuestLogin.
      const guestName = await suggestUniqueDisplayName("Guest");
      const avatarUrl = localAvatarUrl(guestName);
      await loginAnonymously(guestName, avatarUrl);
      setSigningIn(false);
      // authState flips to "guest" once loginAnonymously resolves, re-rendering into children.
    };

    return (
      <View style={styles.center}>
        <Card style={styles.card}>
          <View style={[styles.header, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}>
            <WavingHand size={32} />
            <Text style={[styles.title, { color: colors.text }]}>
              {t("welcome_player", { defaultValue: "Welcome Player!" })}
            </Text>
          </View>

          <View style={styles.body}>
            <Text style={[styles.message, { color: colors.textMuted }]}>
              {t("login_required_message", {
                defaultValue:
                  "You need to be signed in to access this page. You can play as a guest or create an account to save your progress.",
              })}
            </Text>

            <Button
              fullWidth
              loading={signingIn}
              label={t("play_as_guest", { defaultValue: "Play as Guest" })}
              onPress={handleGuestLogin}
            />

            {/* "Play as Guest" creates a real auth.users row, so it is real
                processing and needs notice. No checkbox here on purpose —
                the basis is contract, and adding friction to the low-commitment
                path would be disproportionate to what a guest account holds. */}
            <View style={styles.guestNoticeRow}>
              <Text style={[styles.guestNotice, { color: colors.textMuted }]}>
                {t("privacy_policy_guest_notice", {
                  defaultValue: "By continuing you accept our",
                })}{" "}
              </Text>
              <Text
                accessibilityRole="link"
                onPress={() => navigation.navigate("PrivacyPolicy")}
                style={[styles.guestNotice, styles.guestNoticeLink, { color: colors.accent }]}
              >
                {t("privacy_policy", { defaultValue: "Privacy Policy" })}
              </Text>
            </View>

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>
                {t("or", { defaultValue: "Or" })}
              </Text>
              <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.row}>
              <Button
                variant="ghost"
                style={styles.rowButton}
                label={t("login", { defaultValue: "Log In" })}
                onPress={() => navigation.navigate("Login")}
              />
              <Button
                style={styles.rowButton}
                label={t("signup", { defaultValue: "Sign Up" })}
                onPress={() => navigation.navigate("Signup")}
              />
            </View>

            <Pressable onPress={() => navigation.navigate("Home")}>
              <Text style={[styles.linkMuted, { color: colors.textMuted }]}>
                {t("go_home", { defaultValue: "Go Home" })}
              </Text>
            </Pressable>

            <Pressable onPress={() => navigation.navigate("About")}>
              <Text style={[styles.linkAccent, { color: colors.accent }]}>
                {t("how_it_works", { defaultValue: "How does this game work?" })}
              </Text>
            </Pressable>
          </View>
        </Card>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  card: { width: "100%", maxWidth: 400 },
  header: { padding: 16, borderBottomWidth: 1, alignItems: "center", gap: 6 },
  title: { fontSize: 18, fontWeight: "800" },
  body: { padding: 20, gap: 12, alignItems: "stretch" },
  message: { fontSize: 15, lineHeight: 21, textAlign: "center", marginBottom: 4 },
  row: { flexDirection: "row", gap: 10 },
  rowButton: { flex: 1 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  linkMuted: { fontSize: 13, textAlign: "center", textDecorationLine: "underline", marginTop: 4 },
  guestNoticeRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  guestNotice: { fontSize: 12, lineHeight: 17 },
  guestNoticeLink: { fontWeight: "700", textDecorationLine: "underline" },
  linkAccent: { fontSize: 12, textAlign: "center", marginTop: 2 },
});
