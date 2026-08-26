import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useBoardTileSize } from "./BoardGrid";

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

/**
 * How big the opponent's board is relative to your own.
 *
 * Clearly secondary — it carries no letters, only colours, and yours is the one
 * you type into — but big enough to read across the screen. It was pinned at
 * 22px, which meant that the more room the viewport had the further the two
 * boards drifted apart: yours grew to 38px on a desktop while this stayed put.
 * Deriving it keeps the relationship constant at every size.
 */
const OPPONENT_SCALE = 0.7;
const MIN_TILE = 18;

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

  const ownTileSize = useBoardTileSize(wordLength, rowCount);
  const tileSize = Math.max(MIN_TILE, Math.round(ownTileSize * OPPONENT_SCALE));
  const gap = tileSize >= 24 ? 4 : 3;

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
      <View style={{ gap }}>
        {rows.map((rowIndex) => {
          const isCompletedRow = rowIndex < evaluations.length;
          const isActiveRow = rowIndex === activeRowIndex;
          const rowData = isCompletedRow && evaluations[rowIndex] ? evaluations[rowIndex] : [];

          return (
            <View key={rowIndex} style={[styles.row, { gap }]}>
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

                return (
                  <View
                    key={colIndex}
                    style={[styles.tile, { width: tileSize, height: tileSize, backgroundColor: bg, borderColor }]}
                  />
                );
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
  label: { fontSize: 12, fontWeight: "700", maxWidth: 140 },
  row: { flexDirection: "row" },
  // width/height come from the derived tile size at render time.
  tile: { borderRadius: 3, borderWidth: 2 },
});
