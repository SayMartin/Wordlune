import React from "react";
import { Platform, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTheme } from "../theme/ThemeProvider";

type LetterStatus = "absent" | "present" | "correct";

interface Props {
  guesses: string[];
  evaluations: LetterStatus[][];
  currentGuess: string;
  rows?: number;
  word?: string;
}

const STATUS_COLORS: Record<LetterStatus, { bg: string; border: string }> = {
  absent: { bg: "#78787e4d", border: "#78787e4d" },
  present: { bg: "#c9b458", border: "#c9b458" },
  correct: { bg: "#6aaa64", border: "#6aaa64" },
};

function glyphFor(ch: string) {
  if (ch === " ") return "␣";
  if (/[-‐‑‒–—]/.test(ch)) return "‑";
  return ch;
}

export default function BoardGrid({ guesses, evaluations, currentGuess, rows = 6, word }: Props) {
  const { colors } = useTheme();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const wordLen = (word && word.length) || 5;
  const baseTileSize = wordLen <= 5 ? 30 : wordLen <= 7 ? 26 : wordLen <= 9 ? 22 : wordLen <= 12 ? 18 : 14;

  // On web there's usually a bit more room than on a phone, so let the tiles grow slightly
  // beyond the phone-tuned base size above — but stay height-bounded so the board+keyboard+
  // controls above/below it never outgrow the viewport and force a scroll while playing.
  let tileSize = baseTileSize;
  if (Platform.OS === "web") {
    const gap = 4;
    const availableWidth = Math.min(windowWidth, 896) - 32 /* GameScreen container padding */;
    const fitWidthTile = Math.floor((availableWidth - gap * (wordLen - 1)) / wordLen);
    // Rough budget for the board's own height, leaving room for the header/controls/keyboard/footer above and below it.
    const heightBudget = windowHeight * 0.32;
    const fitHeightTile = Math.floor(heightBudget / rows) - gap;
    tileSize = Math.max(baseTileSize, Math.min(fitWidthTile, fitHeightTile, 38));
  }
  const fontSize = tileSize <= 18 ? 11 : tileSize <= 22 ? 13 : tileSize <= 30 ? 15 : Math.round(tileSize * 0.5);

  return (
    <View style={styles.container}>
      {Array.from({ length: rows }).map((_, rowIdx) => {
        const isPast = rowIdx < guesses.length;
        const isCurrent = rowIdx === guesses.length;
        const guess = isPast ? guesses[rowIdx] : isCurrent ? currentGuess : "";
        const chars = (guess || "").padEnd(wordLen, " ").split("");
        const evalRow = evaluations[rowIdx] || [];

        return (
          <View style={styles.row} key={rowIdx}>
            {chars.map((ch, i) => {
              const status = evalRow[i] as LetterStatus | undefined;
              const isCharFromGuess = i < (guess || "").length;
              const tileColors = isPast && status ? STATUS_COLORS[status] : null;
              const focusIndex = isCurrent && (guess || "").length < wordLen ? (guess || "").length : -1;
              const isFocus = i === focusIndex;

              return (
                <View
                  key={`${rowIdx}-${i}`}
                  style={[
                    styles.tile,
                    { width: tileSize, height: tileSize, borderColor: colors.border },
                    tileColors && { backgroundColor: tileColors.bg, borderColor: tileColors.border },
                    isFocus && { borderColor: "#2563eb" },
                  ]}
                >
                  <Text
                    style={[
                      styles.tileText,
                      { fontSize, color: tileColors ? "#ffffff" : colors.text },
                    ]}
                  >
                    {isCharFromGuess ? glyphFor(ch) : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 4 },
  row: { flexDirection: "row", gap: 4 },
  tile: {
    borderWidth: 1.5,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { fontWeight: "700", textTransform: "uppercase" },
});
