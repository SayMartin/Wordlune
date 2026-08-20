import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../theme/ThemeProvider";
import type { AppParamList } from "../navigation/types";
import ConfirmationOverlay from "./ConfirmationOverlay";

type Nav = NativeStackNavigationProp<AppParamList>;

// The single implementation of "delete my account", used by both the Danger
// Zone in Settings and the standalone /delete-account route. That route exists
// because Google Play requires a web URL where deletion can be started, even
// when the app offers it in-app — having two copies of a destructive flow is
// exactly the kind of thing that drifts, so both render this.
export default function DeleteAccountPanel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { deleteAccount } = useAuth();
  const navigation = useNavigation<Nav>();

  const [deleting, setDeleting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      const result = await deleteAccount();
      if (!result.success) {
        setError(result.error || t("delete_account_failed", { defaultValue: "Failed to delete account" }));
        setShowConfirm(false);
        return;
      }
      navigation.navigate("Main", { screen: "Home" });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: "#dc2626" }]}>
        <Text style={[styles.cardTitle, { color: "#dc2626" }]}>
          {t("danger_zone", { defaultValue: "Danger Zone" })}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
          {t("delete_account_description", {
            defaultValue:
              "Permanently delete your account and all related data — profile, scores, challenge history, and duel matches. This cannot be undone.",
          })}
        </Text>
        {error && <Text style={styles.error}>{error}</Text>}
        <Pressable
          style={[styles.dangerButton, deleting && styles.disabled]}
          onPress={() => setShowConfirm(true)}
          disabled={deleting}
        >
          <Text style={styles.dangerButtonText}>{t("delete_account", { defaultValue: "Delete Account" })}</Text>
        </Pressable>
      </View>

      {showConfirm && (
        <ConfirmationOverlay
          variant="danger"
          title={t("confirm_delete_account_title", { defaultValue: "Delete Account?" })}
          message={t("confirm_delete_account_msg", {
            defaultValue:
              "This will permanently delete your account and all related data — profile, scores, challenge history, and duel matches. This cannot be undone.",
          })}
          confirmText={
            deleting
              ? t("deleting", { defaultValue: "Deleting..." })
              : t("delete_account", { defaultValue: "Delete Account" })
          }
          onConfirm={handleDelete}
          // Cancel is deliberately withheld mid-delete: the request is already
          // in flight server-side and there is nothing to cancel back to.
          onCancel={deleting ? undefined : () => setShowConfirm(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  dangerButton: { backgroundColor: "#dc2626", padding: 12, borderRadius: 8, alignItems: "center" },
  dangerButtonText: { color: "#fff", fontWeight: "700" },
  disabled: { opacity: 0.6 },
  error: { color: "#dc2626", fontSize: 13, marginBottom: 8 },
});
