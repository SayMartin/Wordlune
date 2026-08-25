import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

type LetterStatus = "absent" | "present" | "correct";

interface Props {
  evaluations: LetterStatus[][];
  currentInputLength: number;
  activeRowIndex: number;
  wordLength?: number;
  rowCount?: number;
  playerName?: string;
  score?: number;
}

// Same three colours as your own board (BoardGrid.tsx). They were a different
// slate/yellow/green set before, which meant the opponent's mirrored board had
// to be decoded separately from your own — the one place the colours most need
// to mean the same thing at a glance.
const STATUS_COLORS: Record<LetterStatus, string> = {
  absent: "#78787e4d",
  present: "#c9b458",
  correct: "#6aaa64",
};

export default function OpponentBoard({
  evaluations,
  currentInputLength,
  activeRowIndex,
  wordLength = 5,
  rowCount = 6,
  playerName,
  score = 0,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const displayName = playerName || t("opponent", { defaultValue: "Opponent" });
  const rows = Array.from({ length: rowCount }, (_, i) => i);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.accent2 }]} numberOfLines={1}>
          {displayName}
        </Text>
        <Text style={[styles.label, { color: colors.accent2 }]}>
          {score} {t("points_short", { defaultValue: "pts" })}
        </Text>
      </View>
      <View style={{ gap: 4 }}>
        {rows.map((rowIndex) => {
          const isCompletedRow = rowIndex < evaluations.length;
          const isActiveRow = rowIndex === activeRowIndex;
          const rowData = isCompletedRow && evaluations[rowIndex] ? evaluations[rowIndex] : [];

          return (
            <View key={rowIndex} style={styles.row}>
              {Array.from({ length: wordLength }, (_, colIndex) => {
                let bg = colors.surface;
                let borderColor = colors.border;

                if (isCompletedRow) {
                  const status = rowData[colIndex];
                  if (status) {
                    bg = STATUS_COLORS[status];
                    borderColor = STATUS_COLORS[status];
                  }
                } else if (isActiveRow && colIndex < currentInputLength) {
                  bg = colors.surfaceSunken;
                  borderColor = colors.textMuted;
                }

                return <View key={colIndex} style={[styles.tile, { backgroundColor: bg, borderColor }]} />;
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 6 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 4 },
  label: { fontSize: 11, fontWeight: "700", maxWidth: 100 },
  row: { flexDirection: "row", gap: 4 },
  tile: { width: 22, height: 22, borderRadius: 3, borderWidth: 2 },
});
