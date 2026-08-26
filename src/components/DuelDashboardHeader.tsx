import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import DuelIcon from "./DuelIcon";
import Card from "./ui/Card";
import { getExtensionsForWord } from "../supabase/words-repository";
import { flagFor } from "../utils/languageCycle";

interface Props {
  duelOpponentName: string;
  onExit?: () => void;
  language?: string;
  secret?: string;
  isHintEnabled?: boolean;
}

export default function DuelDashboardHeader({ duelOpponentName, onExit, language, secret, isHintEnabled }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [wordSubcats, setWordSubcats] = useState<{ id: string; name: string }[]>([]);

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

        {/* Leaving the duel screen lives up here, next to who you are playing;
            surrendering the match lives on the control bar with the clocks that
            can end it. The two used to sit the other way round, which put the
            softer of the two exits in the busier spot. */}
        {onExit && (
          <Pressable
            style={[styles.exitButton, { backgroundColor: colors.warningSoft, borderColor: colors.warning }]}
            onPress={onExit}
          >
            <Text style={[styles.exitButtonText, { color: colors.warning }]}>
              {t("quit_game", { defaultValue: "Quit" })}
            </Text>
          </Pressable>
        )}
      </View>

      {/* The secret's own subcategories, the same hint the practice screen shows
          (LetterSlider's hintNames).

          This used to render a fixed row of every Hydrocarbons subcategory and
          highlight the ones the secret belonged to — a decoy-and-reveal design
          that only worked while every duel secret came from that one category.
          Now that the secret is drawn from the whole dictionary, those chips
          would simply never light up for a country or a car brand, so the hint
          shows what the word actually is filed under instead. */}
      {isHintEnabled && wordSubcats.length > 0 && (
        <View style={[styles.chipRow, { borderColor: colors.border }]}>
          {wordSubcats.map((sub) => (
            <View
              key={sub.id}
              style={[
                styles.chip,
                { backgroundColor: colors.warningSoft, borderColor: colors.warning },
              ]}
            >
              <Text style={[styles.chipText, styles.chipTextActive, { color: colors.warning }]}>
                {sub.name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { padding: 14, gap: 10 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  identity: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  vsLabel: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  opponentName: { fontSize: 16, fontWeight: "800" },
  statusCol: { alignItems: "center", gap: 4, marginLeft: 8 },
  langBadge: { fontSize: 10, fontWeight: "700", borderWidth: 1, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  exitButton: { borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  exitButtonText: { fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, borderTopWidth: 1, paddingTop: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  chipText: { fontSize: 10 },
  chipTextActive: { fontWeight: "800" },
});
