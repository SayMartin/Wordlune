import React from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";

/**
 * Your private data on the left, what everyone else can see on the right.
 *
 * The split is the point: Progress pairs a personal history with the public
 * list it feeds, and putting them side by side is what makes "this row is
 * published, that one isn't" legible at a glance instead of something you have
 * to remember across a tab switch.
 *
 * Two columns only when there is room for two. Below the breakpoint they stack,
 * private first — the same 768px `md` boundary WebTopNav uses to collapse into
 * a hamburger, so the whole app changes shape at one width rather than three.
 * Native phones are always below it and always stack, which is correct: two
 * 180px columns of leaderboard would be unreadable.
 */
const BREAKPOINT = 768;

interface Props {
  privateLabel: string;
  publicLabel: string;
  /** One line under each heading saying who can see what. */
  privateHint?: string;
  publicHint?: string;
  privateContent: React.ReactNode;
  publicContent: React.ReactNode;
}

export default function TwoColumn({
  privateLabel,
  publicLabel,
  privateHint,
  publicHint,
  privateContent,
  publicContent,
}: Props) {
  const { width } = useWindowDimensions();
  const side = width >= BREAKPOINT;

  return (
    <View style={[styles.wrap, side && styles.wrapSide]}>
      <View style={[styles.column, side && styles.columnSide]}>
        <ColumnHeading label={privateLabel} hint={privateHint} icon="🔒" />
        {privateContent}
      </View>
      <View style={[styles.column, side && styles.columnSide]}>
        <ColumnHeading label={publicLabel} hint={publicHint} icon="🌍" />
        {publicContent}
      </View>
    </View>
  );
}

function ColumnHeading({ label, hint, icon }: { label: string; hint?: string; icon: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.heading}>
      <Text style={[styles.headingText, { color: colors.text }]}>
        {icon} {label}
      </Text>
      {!!hint && <Text style={[styles.headingHint, { color: colors.textMuted }]}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 20 },
  wrapSide: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  column: { gap: 8 },
  // `minWidth: 0` matters on web: a flex child defaults to `min-width: auto`,
  // which refuses to shrink below its content and would push the row wider than
  // WebCentered's 896px column instead of splitting it in half.
  columnSide: { flex: 1, minWidth: 0 },
  heading: { gap: 2, paddingHorizontal: 2 },
  headingText: { fontSize: 14, fontWeight: "800" },
  headingHint: { fontSize: 11, lineHeight: 15 },
});
