import React, { useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import type { AppParamList } from "../navigation/types";
import { exportMyData } from "../supabase/players-repository";
import { exportFilename, readDeviceSettings, saveJsonExport } from "../utils/exportDownload";

type Nav = NativeStackNavigationProp<AppParamList>;

// Settings -> Data & Privacy. Covers the two rights a user can exercise
// themselves without writing to us: access + portability (Art. 15/20) via the
// export, and a route to the policy. Erasure lives in the Danger Zone below.
export default function DataPrivacyPanel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();

  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setDone(null);
    try {
      const data = await exportMyData();
      if (!data) {
        setError(t("export_failed", { defaultValue: "Could not prepare your data. Please try again." }));
        return;
      }
      data.device_settings = await readDeviceSettings();

      const outcome = await saveJsonExport(exportFilename(), JSON.stringify(data, null, 2));
      setDone(
        outcome === "downloaded"
          ? t("export_done_web", { defaultValue: "Your file has been downloaded." })
          : t("export_done_native", { defaultValue: "Choose where to save your file." }),
      );
    } catch (e: any) {
      console.error("data export failed", e);
      setError(t("export_failed", { defaultValue: "Could not prepare your data. Please try again." }));
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: "#6366f1" }]}>
        {t("data_privacy_title", { defaultValue: "Data & Privacy" })}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {t("data_privacy_body", {
          defaultValue:
            "Download everything we hold about you — your account, profile, scores, challenge history and duels — as a JSON file.",
        })}
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}
      {done && <Text style={styles.success}>{done}</Text>}

      <Pressable
        style={[styles.primaryButton, { backgroundColor: colors.accent }, exporting && styles.disabled]}
        onPress={handleExport}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.primaryButtonText}>
            {t("export_my_data", { defaultValue: "Download my data" })}
          </Text>
        )}
      </Pressable>

      <Pressable onPress={() => navigation.navigate("PrivacyPolicy")} style={styles.linkRow}>
        <Text style={[styles.link, { color: colors.accent }]}>
          {t("privacy_policy", { defaultValue: "Privacy Policy" })}
        </Text>
      </Pressable>

      <Text style={[styles.footnote, { color: colors.textMuted }]}>
        {t("data_erasure_pointer", {
          defaultValue: "To delete your account and all of this data, use the Danger Zone below.",
        })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  body: { fontSize: 13, lineHeight: 19 },
  primaryButton: { padding: 12, borderRadius: 8, alignItems: "center" },
  primaryButtonText: { color: "#ffffff", fontWeight: "700" },
  disabled: { opacity: 0.6 },
  linkRow: { alignItems: "center" },
  link: { fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  footnote: { fontSize: 12, lineHeight: 17 },
  error: { color: "#dc2626", fontSize: 13 },
  success: { color: "#16a34a", fontSize: 13 },
});
