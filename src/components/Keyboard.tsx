import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

type LetterStatus = "absent" | "present" | "correct";

interface Props {
  onKey: (k: string) => void;
  onEnter: () => void;
  onDelete: () => void;
  state?: Record<string, LetterStatus>;
  highlightControlKeys?: boolean;
  language?: string;
}

const LAYOUTS: Record<string, string[]> = {
  en: ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"],
  sv: ["QWERTYUIOPÅ", "ASDFGHJKLÖÄ", "ZXCVBNM"],
  // Real AZERTY letter rows, plus a 4th row of the accented letters that
  // appear in the seeded French word content — matching is accent-sensitive
  // (see useGame.ts), so players need a way to actually type them.
  fr: ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBN", "ÉÈÊÀÂÇÎÔÙÛ"],
};

const STATUS_COLORS: Record<LetterStatus, string> = {
  absent: "#78787e80",
  present: "#c9b458",
  correct: "#6aaa64",
};

export default function Keyboard({ onKey, onEnter, onDelete, state = {}, highlightControlKeys, language }: Props) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const lang = language || i18n.language || "en";
  const rows = LAYOUTS[lang.split("-")[0]] || LAYOUTS.en;

  const keyStyle = (ch: string) => {
    const st = state[ch];
    return st ? { backgroundColor: STATUS_COLORS[st], borderColor: STATUS_COLORS[st] } : { borderColor: colors.border };
  };
  const keyTextColor = (ch: string) => (state[ch] ? "#ffffff" : colors.text);

  return (
    <View style={styles.container}>
      {rows.map((row, ridx) => (
        <View key={ridx} style={styles.row}>
          {row.split("").map((ch) => (
            <Pressable key={ch} style={[styles.key, keyStyle(ch)]} onPress={() => onKey(ch)}>
              <Text style={[styles.keyText, { color: keyTextColor(ch) }]}>{ch}</Text>
            </Pressable>
          ))}
          {ridx === rows.length - 1 && (
            <>
              <Pressable style={[styles.key, keyStyle(" ")]} onPress={() => onKey(" ")}>
                <Text style={[styles.keyText, { color: keyTextColor(" ") }]}>␣</Text>
              </Pressable>
              <Pressable style={[styles.key, keyStyle("-")]} onPress={() => onKey("-")}>
                <Text style={[styles.keyText, { color: keyTextColor("-") }]}>‑</Text>
              </Pressable>
              <Pressable style={[styles.key, styles.deleteKey, { borderColor: colors.border }]} onPress={onDelete}>
                <Text style={[styles.keyText, { color: colors.text }]}>⌫</Text>
              </Pressable>
            </>
          )}
        </View>
      ))}
      <View style={styles.enterKeyRow}>
        <Pressable
          style={[
            styles.enterKey,
            highlightControlKeys
              ? { borderColor: colors.accent, backgroundColor: colors.accent }
              : { borderColor: colors.border, backgroundColor: colors.surface, opacity: 0.5 },
          ]}
          onPress={onEnter}
        >
          <Text
            style={[
              styles.keyText,
              { color: highlightControlKeys ? "#ffffff" : colors.text, fontWeight: "700" },
            ]}
          >
            {t("enter", { defaultValue: "Enter" })} ⏎
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 6, padding: 4, width: "100%" },
  row: { flexDirection: "row", gap: 4, justifyContent: "center" },
  key: {
    flex: 1,
    height: 42,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteKey: { flex: 1.5 },
  keyText: { fontWeight: "600", fontSize: 14 },
  enterKeyRow: { alignItems: "center", marginTop: 4 },
  enterKey: {
    height: 44,
    width: "80%",
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
