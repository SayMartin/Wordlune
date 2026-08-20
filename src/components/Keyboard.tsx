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
  // (see useGame.ts), so players need a way to actually type them. Ä/Ö/Å
  // aren't native French letters, but word_fr deliberately reuses word_sv's
  // native spelling for Swedish place-name categories (see CLAUDE.md) —
  // tacked onto the end of the WXCVBN row rather than growing the already-
  // full accent row further.
  fr: ["AZERTYUIOP", "QSDFGHJKLM", "WXCVBNÄÖÅ", "ÉÈÊÀÂÇÎÔÙÛ"],
};

// French's last letter row is already a full 10-key accent row — space and
// hyphen move down to the Enter row (left of Enter) for that language
// instead of being squeezed onto the end of it. Other languages keep them on
// the last letter row as usual.
const SPACE_HYPHEN_ON_ENTER_ROW: Record<string, boolean> = {
  fr: true,
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
  const langKey = lang.split("-")[0];
  const rows = LAYOUTS[langKey] || LAYOUTS.en;
  const spaceHyphenOnEnterRow = SPACE_HYPHEN_ON_ENTER_ROW[langKey] ?? false;

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
          {ridx === rows.length - 1 && !spaceHyphenOnEnterRow && (
            <>
              <Pressable style={[styles.key, keyStyle(" ")]} onPress={() => onKey(" ")}>
                <Text style={[styles.keyText, { color: keyTextColor(" ") }]}>␣</Text>
              </Pressable>
              <Pressable style={[styles.key, keyStyle("-")]} onPress={() => onKey("-")}>
                <Text style={[styles.keyText, { color: keyTextColor("-") }]}>‑</Text>
              </Pressable>
            </>
          )}
        </View>
      ))}
      {/* Delete lives on the Enter row (right of Enter) for every language —
          keeps it off the already-full last letter row and gives it a
          consistent, predictable spot regardless of how many letter rows a
          language has. Enter itself is a fixed 60% width and always
          centered: the two side zones are equal-flex containers sharing the
          remaining 40%, whether or not one of them is empty. */}
      <View style={styles.enterKeyRow}>
        <View style={[styles.enterSide, styles.enterSideLeft]}>
          {spaceHyphenOnEnterRow && (
            <>
              <Pressable style={[styles.sideKey, keyStyle(" ")]} onPress={() => onKey(" ")}>
                <Text style={[styles.keyText, { color: keyTextColor(" ") }]}>␣</Text>
              </Pressable>
              <Pressable style={[styles.sideKey, keyStyle("-")]} onPress={() => onKey("-")}>
                <Text style={[styles.keyText, { color: keyTextColor("-") }]}>‑</Text>
              </Pressable>
            </>
          )}
        </View>
        <Pressable
          style={[
            styles.enterKey,
            highlightControlKeys
              ? { borderColor: colors.accent, backgroundColor: colors.accent }
              : { borderColor: colors.border, backgroundColor: colors.surface, opacity: 0.4 },
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
        <View style={[styles.enterSide, styles.enterSideRight]}>
          <Pressable style={[styles.sideKey, styles.deleteSideKey, { borderColor: colors.border }]} onPress={onDelete}>
            <Text style={[styles.keyText, { color: colors.text }]}>⌫</Text>
          </Pressable>
        </View>
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
  keyText: { fontWeight: "600", fontSize: 14 },
  enterKeyRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  enterKey: {
    height: 44,
    width: "50%",
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Equal-flex zones on either side of Enter — always the same width as
  // each other (sharing the 50% Enter doesn't take), whether or not one of
  // them is empty, so Enter's fixed 50% stays centered on the row. Their
  // buttons (sideKey) are flex:1 too, so they split whatever width the zone
  // has evenly between however many of them are present.
  enterSide: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  enterSideLeft: { paddingRight: 6 },
  enterSideRight: { paddingLeft: 6 },
  sideKey: {
    flex: 1,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  // Slightly wider than its siblings (same ratio as the old last-row delete
  // key) — same flex-based sizing, just a bigger share.
  deleteSideKey: { flex: 1.4 },
});
