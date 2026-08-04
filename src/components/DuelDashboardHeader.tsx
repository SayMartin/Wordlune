import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import DuelIcon from "./DuelIcon";
import { getExtensionsForWord, getAllHydrocarbonSubcategories } from "../supabase/words-repository";

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
  const [allHydroList, setAllHydroList] = useState<{ id: string; name_en: string; name_sv: string }[]>([]);

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
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.topRow}>
        <View style={styles.identity}>
          <DuelIcon size={36} />
          <View>
            <Text style={styles.vsLabel}>{t("dueling_against", { defaultValue: "Dueling vs" })}</Text>
            <Text style={styles.opponentName}>{duelOpponentName}</Text>
          </View>
          <View style={styles.statusCol}>
            {language && (
              <Text style={[styles.langBadge, { color: colors.textMuted, borderColor: colors.border }]}>
                {language.startsWith("sv") ? "🇸🇪 SV" : "🇬🇧 EN"}
              </Text>
            )}
            <Text style={{ opacity: isHintEnabled ? 1 : 0.25, fontSize: 16 }}>💡</Text>
          </View>
        </View>

        {onDuelForfeit && (
          <Pressable style={styles.forfeitButton} onPress={onDuelForfeit}>
            <Text style={styles.forfeitText}>🏳️ {t("surrender", { defaultValue: "Surrender" })}</Text>
          </Pressable>
        )}
      </View>

      {allHydroList.length > 0 && (
        <View style={[styles.chipRow, { borderColor: colors.border }]}>
          {allHydroList.map((sub) => {
            const isActive = isHintEnabled && wordSubcats.some((ws) => ws.id === sub.id);
            const displayName = language?.startsWith("sv") ? sub.name_sv : sub.name_en;
            return (
              <View
                key={sub.id}
                style={[
                  styles.chip,
                  isActive ? styles.chipActive : { backgroundColor: colors.background, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{displayName || sub.name_en}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 10 },
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  identity: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  vsLabel: { fontSize: 10, fontWeight: "700", color: "#16a34a", textTransform: "uppercase" },
  opponentName: { fontSize: 16, fontWeight: "800", color: "#ea580c" },
  statusCol: { alignItems: "center", gap: 4, marginLeft: 8 },
  langBadge: { fontSize: 10, fontWeight: "700", borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  forfeitButton: { borderWidth: 1, borderColor: "#fecaca", backgroundColor: "#fef2f2", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  forfeitText: { color: "#dc2626", fontWeight: "700", fontSize: 11 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, borderTopWidth: 1, paddingTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipActive: { backgroundColor: "#facc15", borderColor: "#eab308" },
  chipText: { fontSize: 10, color: "#64748b" },
  chipTextActive: { color: "#713f12", fontWeight: "800" },
});
