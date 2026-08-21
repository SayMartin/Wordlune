import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeProvider";
import type { AppParamList } from "../navigation/types";
import DeleteAccountPanel from "../components/DeleteAccountPanel";
import { SUPPORT_EMAIL } from "../constants/privacy";

type Nav = NativeStackNavigationProp<AppParamList>;

// Reachable at /delete-account. Exists to satisfy Google Play's requirement
// for a *web URL* where account deletion can be initiated — the in-app path
// (Settings → Danger Zone) is not sufficient on its own for the Play listing.
//
// Deliberately not behind SessionGate: someone arriving from the Play listing
// is quite likely signed out, and bouncing them to a "sign in first" wall with
// no explanation is exactly what the requirement exists to prevent. Signed-out
// visitors get the explanation plus both routes forward (sign in, or email us).
export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { session, authState } = useAuth();
  const navigation = useNavigation<Nav>();

  const signedIn = !!session;
  const isGuest = authState === "guest";

  // Signed out, the full (registered) list is the right thing to show: this is
  // the page registered with Google Play, the reader could be either kind of
  // account, and the superset is the honest answer. Only once we know we're
  // talking to a guest is it worth narrowing — a guest has no sign-in details
  // and can never have challenge history, since Competitive Mode is
  // registered-only.
  const deletedItems = [
    isGuest
      ? t("delete_account_what_1_guest", { defaultValue: "Your guest account" })
      : t("delete_account_what_1", { defaultValue: "Your account and sign-in details" }),
    t("delete_account_what_2", { defaultValue: "Your profile — display name, avatar and settings" }),
    t("delete_account_what_3", { defaultValue: "All your scores and practice history" }),
    ...(isGuest
      ? []
      : [t("delete_account_what_4", { defaultValue: "Your challenge attempts and results" })]),
    t("delete_account_what_5", { defaultValue: "Your duel matches" }),
  ];

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View>
        <Text style={[styles.pageTitle, { color: colors.text }]}>
          {t("delete_account", { defaultValue: "Delete Account" })}
        </Text>
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          {t("delete_account_page_intro", {
            defaultValue:
              "You can delete your Wordlune account and everything attached to it at any time. This cannot be undone.",
          })}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: "#6366f1" }]}>
          {t("delete_account_what_title", { defaultValue: "What gets deleted" })}
        </Text>
        {deletedItems.map((item, i) => (
          <Text key={i} style={[styles.bulletItem, { color: colors.textMuted }]}>
            • {item}
          </Text>
        ))}
        {isGuest && (
          <Text style={[styles.note, { color: colors.textMuted }]}>
            {t("delete_account_guest_note", {
              defaultValue:
                "A guest account has no email or password, so it can't be recovered afterwards — and it can't be signed into from another device even now. If you'd rather keep your scores, sign up instead: that turns this same account into a full one, with everything intact.",
            })}
          </Text>
        )}
        <Text style={[styles.note, { color: colors.textMuted }]}>
          {t("delete_account_backups_note", {
            defaultValue:
              "Deleted data may persist briefly in encrypted database backups before those expire on their normal schedule.",
          })}
        </Text>
      </View>

      {signedIn ? (
        <DeleteAccountPanel />
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: "#6366f1" }]}>
            {t("delete_account_how_title", { defaultValue: "How to delete it" })}
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>
            {t("delete_account_signed_out", {
              defaultValue:
                "Sign in and come back to this page, or use Settings → Danger Zone in the app. Deleting takes effect immediately.",
            })}
          </Text>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate("Login")}
          >
            <Text style={styles.primaryButtonText}>
              {t("delete_account_login_cta", { defaultValue: "Log in to delete your account" })}
            </Text>
          </Pressable>

          <Text style={[styles.body, styles.emailFallback, { color: colors.textMuted }]}>
            {t("delete_account_email_fallback", {
              defaultValue:
                "If you can't sign in, email us from the address registered to the account and we'll delete it for you. We answer within one month.",
            })}
          </Text>
          <Text
            accessibilityRole="link"
            onPress={() =>
              Linking.openURL(
                `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Wordlune — account deletion request")}`,
              )
            }
            style={[styles.body, styles.link, { color: colors.accent }]}
          >
            {SUPPORT_EMAIL}
          </Text>
        </View>
      )}

      <Pressable onPress={() => navigation.navigate("PrivacyPolicy")}>
        <Text style={[styles.body, styles.link, styles.centered, { color: colors.accent }]}>
          {t("privacy_policy", { defaultValue: "Privacy Policy" })}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 20 },
  pageTitle: { fontSize: 26, fontWeight: "800", marginBottom: 8 },
  intro: { fontSize: 16, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 8 },
  cardTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  body: { fontSize: 14, lineHeight: 20 },
  bulletItem: { fontSize: 14, lineHeight: 20 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 8, fontStyle: "italic" },
  primaryButton: { padding: 12, borderRadius: 8, alignItems: "center", marginTop: 8 },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  emailFallback: { marginTop: 12 },
  link: { fontWeight: "700", textDecorationLine: "underline" },
  centered: { textAlign: "center" },
});
