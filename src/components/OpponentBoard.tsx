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

const STATUS_COLORS: Record<LetterStatus, string> = {
  absent: "#94a3b8",
  present: "#eab308",
  correct: "#22c55e",
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
        <Text style={styles.label} numberOfLines={1}>{displayName}</Text>
        <Text style={styles.label}>
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
                  bg = colors.background;
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
  label: { fontSize: 11, fontWeight: "700", color: "#ea580c", maxWidth: 100 },
  row: { flexDirection: "row", gap: 4 },
  tile: { width: 22, height: 22, borderRadius: 3, borderWidth: 2 },
});
