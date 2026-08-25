import React, { useEffect, useId, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../theme/ThemeProvider";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

// iOS proportions (51×31 with a 27pt knob), rounded down a little to sit
// comfortably next to 13px label text.
const TRACK_WIDTH = 50;
const TRACK_HEIGHT = 30;
const KNOB_SIZE = 26;
const KNOB_INSET = 2;
const KNOB_TRAVEL = TRACK_WIDTH - KNOB_SIZE - KNOB_INSET * 2;

/**
 * An iOS-style switch, hand-rolled rather than React Native's `Switch`.
 *
 * `Switch` was giving us almost none of the palette: react-native-web renders
 * its own control and honours `trackColor` only partially, so the two switches
 * on the Game screen came out in stock colours that matched nothing around
 * them, and looked different again on native.
 *
 * The lit half of the track is the brand gradient — the same blue→violet as
 * the primary Button and the logo — cross-faded over the neutral track rather
 * than interpolated to it, since a gradient isn't a colour Animated can
 * interpolate towards. One driver value runs both that fade and the knob's
 * slide, so they can never fall out of step.
 */
export default function Toggle({ checked, onChange, label, disabled = false }: ToggleProps) {
  const { colors } = useTheme();
  // Unique per instance: several SVGs in one document that all define the same
  // gradient id would have every `url(#id)` resolve to whichever one happens to
  // be first in document order, so unmounting that one blanks the rest.
  const gradientId = `wlSwitch${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const progress = useRef(new Animated.Value(checked ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: checked ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.ease),
      // false, not merely unset: the track cross-fade animates backgroundColor
      // and opacity together with the transform, and the native driver can
      // drive neither. Gating it per platform would only split one animation
      // into two that could drift.
      useNativeDriver: false,
    }).start();
  }, [checked, progress]);

  const knobOffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [KNOB_INSET, KNOB_INSET + KNOB_TRAVEL],
  });

  const toggle = () => {
    if (!disabled) onChange(!checked);
  };

  const control = (
    <View style={[styles.track, { backgroundColor: colors.controlTrack, borderColor: colors.border }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.accent} />
              <Stop offset="1" stopColor={colors.accent2} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.knob, { transform: [{ translateX: knobOffset }] }]} />
    </View>
  );

  return (
    <Pressable
      // The label is part of the target, not decoration next to it — 13px text
      // beside a 30px control is otherwise the easiest thing on the row to miss.
      onPress={toggle}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      style={[styles.row, disabled && styles.disabled]}
    >
      {control}
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  disabled: { opacity: 0.4 },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    justifyContent: "center",
    // Clips the gradient layer to the pill instead of letting its square
    // corners show through at the ends.
    overflow: "hidden",
  },
  knob: {
    width: KNOB_SIZE,
    height: KNOB_SIZE,
    borderRadius: KNOB_SIZE / 2,
    // White in both themes, like iOS: the knob is the one thing on the control
    // that should never change with the palette, because its whole job is to
    // stay legible against either half of the track.
    backgroundColor: "#ffffff",
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.28), 0 0 1px rgba(0, 0, 0, 0.16)",
  },
  label: { fontSize: 13, fontWeight: "500" },
});
