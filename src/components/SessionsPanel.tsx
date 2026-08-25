import React, { useState } from "react";
import { StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeProvider";
import type { AppParamList } from "../navigation/types";
import ConfirmationOverlay from "./ConfirmationOverlay";
import Card from "./ui/Card";
import Button from "./ui/Button";

type Nav = NativeStackNavigationProp<AppParamList>;

// Settings -> Sessions. The counterpart to logout() being scoped "local":
// signing out here no longer touches other devices, so there has to be a way
// to reach a device you no longer have.
//
// Hidden for guests. A guest account has no credentials, so it cannot be
// signed in anywhere except the device that created it — there is never a
// second session to revoke, and offering the button would only raise a
// question the answer to which is "not applicable to you".
export default function SessionsPanel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { authState, logoutEverywhere } = useAuth();
  const navigation = useNavigation<Nav>();

  const [showConfirm, setShowConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (authState !== "registered") return null;

  const handleSignOutEverywhere = async () => {
    setWorking(true);
    setError(null);
    try {
      const result = await logoutEverywhere();
      if (!result.success) {
        // Local state is already cleared either way, so the user IS signed out
        // here — but we can't claim the other devices were reached. Saying so
        // is better than a false "done": someone doing this because they lost
        // a phone needs to know whether to go and change their password.
        setError(
          t("sign_out_everywhere_unconfirmed", {
            defaultValue:
              "You've been signed out on this device, but we couldn't confirm the others. Check your connection and try again.",
          }),
        );
        setShowConfirm(false);
        return;
      }
      navigation.navigate("Main", { screen: "Home" });
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.accent }]}>
          {t("sessions_title", { defaultValue: "Sessions" })}
        </Text>
        <Text style={[styles.body, { color: colors.textMuted }]}>
          {t("sessions_body", {
            defaultValue:
              "Signing out only affects the device you're using. If you've lost a device, or think someone else has access to your account, sign out everywhere — this signs you out here too.",
          })}
        </Text>

        {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

        <Button
          variant="ghost"
          fullWidth
          loading={working}
          label={t("sign_out_everywhere", { defaultValue: "Sign out everywhere" })}
          onPress={() => setShowConfirm(true)}
        />
      </Card>

      {showConfirm && (
        <ConfirmationOverlay
          variant="warning"
          title={t("confirm_sign_out_everywhere_title", { defaultValue: "Sign out everywhere?" })}
          message={t("confirm_sign_out_everywhere_msg", {
            defaultValue:
              "This signs you out on every device, including this one. You'll need to log in again. Your account and data are not affected.",
          })}
          confirmText={
            working
              ? t("signing_out", { defaultValue: "Signing out..." })
              : t("sign_out_everywhere", { defaultValue: "Sign out everywhere" })
          }
          onConfirm={handleSignOutEverywhere}
          onCancel={working ? undefined : () => setShowConfirm(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  body: { fontSize: 13, lineHeight: 19 },
  error: { fontSize: 13 },
});
