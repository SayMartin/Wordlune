import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import type { AppParamList } from "../navigation/types";
import { exportMyData } from "../supabase/players-repository";
import { exportFilename, readDeviceSettings, saveJsonExport } from "../utils/exportDownload";
import Card from "./ui/Card";
import Button from "./ui/Button";

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
    <Card style={styles.card}>
      <Text style={[styles.cardTitle, { color: colors.accent }]}>
        {t("data_privacy_title", { defaultValue: "Data & Privacy" })}
      </Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>
        {t("data_privacy_body", {
          defaultValue:
            "Download everything we hold about you — your account, profile, scores, challenge history and duels — as a JSON file.",
        })}
      </Text>

      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
      {done && <Text style={[styles.success, { color: colors.success }]}>{done}</Text>}

      <Button
        fullWidth
        loading={exporting}
        label={t("export_my_data", { defaultValue: "Download my data" })}
        onPress={handleExport}
      />

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
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 18, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  body: { fontSize: 13, lineHeight: 19 },
  linkRow: { alignItems: "center" },
  link: { fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
  footnote: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 13 },
  success: { fontSize: 13 },
});
