import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import DuelIcon from "./DuelIcon";
import Card from "./ui/Card";
import { getExtensionsForWord, getAllHydrocarbonSubcategories } from "../supabase/words-repository";
import { flagFor } from "../utils/languageCycle";

interface Props {
  duelOpponentName: string;
  onDuelForfeit?: () => void;
  language?: string;
  secret?: string;
  isHintEnabled?: boolean;
}

export default function DuelDashboardHeader({ duelOpponentName, onDuelForfeit, language, secret, isHintEnabled }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [wordSubcats, setWordSubcats] = useState<{ id: string; name: string }[]>([]);
  const [allHydroList, setAllHydroList] = useState<{ id: string; name_en: string; name_sv: string; name_fr: string }[]>([]);

  useEffect(() => {
    getAllHydrocarbonSubcategories().then(setAllHydroList);
  }, []);

  useEffect(() => {
    const lookupLang = language?.split("-")[0] || "en";
    if (secret) {
      getExtensionsForWord(secret.trim(), lookupLang).then((data) => {
        setWordSubcats(data?.subcategories || []);
      });
    } else {
      setWordSubcats([]);
    }
  }, [secret, language]);

  return (
    <Card style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <DuelIcon size={36} />
          <View>
            <Text style={[styles.vsLabel, { color: colors.textMuted }]}>
              {t("dueling_against", { defaultValue: "Dueling vs" })}
            </Text>
            <Text style={[styles.opponentName, { color: colors.accent2 }]}>{duelOpponentName}</Text>
          </View>
          <View style={styles.statusCol}>
            {language && (
              <Text style={[styles.langBadge, { color: colors.textMuted, borderColor: colors.border }]}>
                {flagFor(language)} {language.split("-")[0].toUpperCase()}
              </Text>
            )}
            <Text style={{ opacity: isHintEnabled ? 1 : 0.25, fontSize: 16 }}>💡</Text>
          </View>
        </View>

        {onDuelForfeit && (
          <Pressable
            style={[styles.forfeitButton, { borderColor: colors.danger, backgroundColor: colors.dangerSoft }]}
            onPress={onDuelForfeit}
          >
            <Text style={[styles.forfeitText, { color: colors.danger }]}>
              🏳️ {t("surrender", { defaultValue: "Surrender" })}
            </Text>
          </Pressable>
        )}
      </View>

      {allHydroList.length > 0 && (
        <View style={[styles.chipRow, { borderColor: colors.border }]}>
          {allHydroList.map((sub) => {
            const isActive = isHintEnabled && wordSubcats.some((ws) => ws.id === sub.id);
            const langCode = language?.split("-")[0];
            const displayName = langCode === "sv" ? sub.name_sv : langCode === "fr" ? sub.name_fr : sub.name_en;
            return (
              <View
                key={sub.id}
                style={[
                  styles.chip,
                  isActive
                    ? { backgroundColor: colors.warningSoft, borderColor: colors.warning }
                    : { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isActive ? colors.warning : colors.textMuted },
                    isActive && styles.chipTextActive,
                  ]}
                >
                  {displayName || sub.name_en}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 10 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  identity: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  vsLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  opponentName: { fontSize: 16, fontWeight: "800" },
  statusCol: { alignItems: "center", gap: 4, marginLeft: 8 },
  langBadge: { fontSize: 10, fontWeight: "700", borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  forfeitButton: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  forfeitText: { fontWeight: "700", fontSize: 11 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, borderTopWidth: 1, paddingTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 10 },
  chipTextActive: { fontWeight: "800" },
});
