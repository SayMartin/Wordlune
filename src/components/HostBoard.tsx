import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import BoardGrid from "./BoardGrid";
import type { Match } from "../supabase/matches-repository";

interface Props {
  match: Match | null;
  names: { p1: string; p2: string };
  score: number;
  guesses: string[];
  evaluations: any[][];
  currentGuess: string;
  secret?: string;
  userId?: string;
}

export default function HostBoard({ match, names, score, guesses, evaluations, currentGuess, secret, userId }: Props) {
  const { t } = useTranslation();
  const myName = userId === match?.player1_id ? names.p1 : names.p2;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>
          {t("me", { defaultValue: "Me" })} ({myName})
        </Text>
        <Text style={styles.label}>
          {score} {t("points_short", { defaultValue: "pts" })}
        </Text>
      </View>
      <BoardGrid guesses={guesses} evaluations={evaluations} currentGuess={currentGuess} word={secret} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", gap: 6 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", paddingHorizontal: 4 },
  label: { fontSize: 11, fontWeight: "700", color: "#16a34a" },
});
