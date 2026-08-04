import React from "react";
import { StyleSheet, Text, View } from "react-native";
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
  const wordLen = (word && word.length) || 5;
  const tileSize = wordLen <= 5 ? 44 : wordLen <= 7 ? 38 : wordLen <= 9 ? 32 : wordLen <= 12 ? 26 : 20;

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
                      { color: tileColors ? "#ffffff" : colors.text },
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
  container: { alignItems: "center", gap: 6 },
  row: { flexDirection: "row", gap: 6 },
  tile: {
    borderWidth: 2,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: { fontWeight: "700", fontSize: 16, textTransform: "uppercase" },
});
