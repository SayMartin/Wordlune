import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

type Mode = "practice" | "competitive" | "duel";

interface Props {
  mode: Mode;
  onChange: (mode: Mode) => void;
  disabled?: boolean;
}

const MODES: { key: Mode; emoji: string; labelKey: string; fallback: string; available: boolean }[] = [
  { key: "practice", emoji: "☕", labelKey: "practice", fallback: "Practice", available: true },
  { key: "competitive", emoji: "🏆", labelKey: "competitive", fallback: "Competitive", available: true },
  { key: "duel", emoji: "⚔️", labelKey: "duel", fallback: "Duel", available: true },
];

const BUTTON_SIZE = 40;
const BUTTON_GAP = 6;

export default function GameModeToggle({ mode, onChange, disabled = false }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  // Native has no hover concept — onHoverIn/onHoverOut simply never fire
  // there, so this stays permanently null and the tooltip never renders,
  // which is the desired behavior (touch has no equivalent to hover).
  const [hoveredKey, setHoveredKey] = useState<Mode | null>(null);

  const labelFor = (m: (typeof MODES)[number]) =>
    t(m.labelKey, { defaultValue: m.fallback }) + (!m.available ? " 🔒" : "");

  const hoveredIndex = MODES.findIndex((m) => m.key === hoveredKey);
  const hovered = hoveredIndex === -1 ? undefined : MODES[hoveredIndex];

  // The bubble's RIGHT edge lines up with the hovered button's right edge, and
  // it grows leftward from there.
  //
  // Which way it grows isn't a style choice — it's dictated by where this
  // control lives. The group sits at the far right of the filter card, with
  // about 10px to its right and the whole card to its left, and Card clips
  // (`overflow: "hidden"`). Anything growing rightward is cut; anything growing
  // leftward has room to spare, in every language.
  //
  // Anchoring per button matters as much as the direction: pinning one bubble
  // to the group's right edge put "Practice" under the Duel button, which reads
  // as a label for the wrong thing.
  const tooltipRight =
    hoveredIndex === -1 ? 0 : (MODES.length - 1 - hoveredIndex) * (BUTTON_SIZE + BUTTON_GAP);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {MODES.map((m) => {
          const isActive = mode === m.key;
          const isDisabled = disabled || !m.available;
          return (
            <Pressable
              key={m.key}
              style={[
                styles.button,
                { borderColor: colors.border },
                isActive && { backgroundColor: colors.accent, borderColor: colors.accent },
                isDisabled && styles.disabledState,
              ]}
              onPress={() => m.available && onChange(m.key)}
              onHoverIn={() => setHoveredKey(m.key)}
              onHoverOut={() => setHoveredKey(null)}
              disabled={isDisabled}
              accessibilityLabel={labelFor(m)}
              accessibilityState={{ selected: isActive }}
            >
              <Text style={[styles.icon, { color: isActive ? colors.onAccent : colors.text }]}>
                {m.emoji}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* One tooltip, rendered as a sibling of the button row rather than one
          per button inside it.

          Per-button bubbles could not come forward at all: react-native-web
          emits every View with `position: relative; z-index: 0`, which makes
          each one its own stacking context — so a bubble's z-index was trapped
          inside its own button's wrapper and lost to the sibling buttons drawn
          after it. Raising the number does nothing.

          It also opens downward, not up: above the buttons there are ~15px
          before Card's `overflow: hidden` cuts, and the bubble needs about
          twice that. Below it there is the whole card. */}
      {hovered && (
        <View
          style={[
            styles.tooltip,
            { right: tooltipRight, backgroundColor: colors.surfaceSolid, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.tooltipText, { color: colors.text }]} numberOfLines={1}>
            {labelFor(hovered)}
          </Text>
        </View>
      )}
    </View>
  );
}

// Fixed height (matching CategorySelector's expandButton) instead of
// padding-derived height — emoji glyphs have inconsistent line-box metrics
// across browsers/fonts, so padding math alone doesn't reliably line the two
// controls up.
const styles = StyleSheet.create({
  // `elevated` so the tooltip clears the rows below it inside the same card.
  // Because of the stacking-context note above, this has to be repeated on
  // every ancestor between here and the tooltip's nearest common parent with
  // whatever it needs to cover — see CategorySelector's headerRow.
  container: { flexShrink: 0, zIndex: 20 },
  row: { flexDirection: "row", gap: BUTTON_GAP },
  button: {
    height: BUTTON_SIZE,
    width: BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 2,
  },
  icon: { fontSize: 20, lineHeight: 24 },
  // Shared disabled recipe across the app: uniform opacity fade, no per-button
  // custom disabled color.
  disabledState: { opacity: 0.4 },
  tooltip: {
    // No width and no `left`: the bubble sizes to its label, and `right` is set
    // per hovered button at render time so it grows leftward from there.
    position: "absolute",
    top: "100%",
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    borderWidth: 1,
    zIndex: 20,
    pointerEvents: "none",
  },
  tooltipText: { fontSize: 12, fontWeight: "600", textAlign: "center" },
});
