import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "./ThemeProvider";

/**
 * The page background: appfinningar.se's dark blue base with two soft light
 * sources at the top corners and a third bloom low in the middle.
 *
 * Native only. On web the same gradient is painted onto <body> as real CSS
 * (webTheme.ts) so it can use `background-attachment: fixed` — the glow has to
 * stay put while content scrolls, and nothing in React Native does that.
 *
 * Drawn with react-native-svg rather than expo-linear-gradient because
 * `radial-gradient` is the whole effect and expo-linear-gradient has no radial
 * mode — and because react-native-svg is already a dependency here (Avatar,
 * Logo, DuelIcon), so this needs no new native module and no rebuild of the
 * committed android/ and ios/ directories.
 *
 * viewBox 0 0 100 100 with preserveAspectRatio="none" lets the gradients be
 * declared in fractions of the screen and stretch to whatever shape the device
 * is, so there is no dimension listener to keep in sync.
 */
export default function AppBackground() {
  const { theme, colors } = useTheme();

  // Web paints this on <body>; a second copy here would sit on top of it and
  // cover the grain.
  if (Platform.OS === "web") return null;

  // Light mode is flat on purpose — see palettes.ts.
  if (theme === "light") {
    return (
      <View style={[StyleSheet.absoluteFill, styles.layer, { backgroundColor: colors.background }]} />
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, styles.layer]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="wlBase" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.background} />
            <Stop offset="0.46" stopColor={colors.backgroundMid} />
            <Stop offset="1" stopColor={colors.backgroundDeep} />
          </LinearGradient>

          {/* Top left, blue. Sits partly off-canvas (cy is negative) so only
              the falloff is visible rather than a discernible disc. */}
          <RadialGradient id="wlGlowA" cx="0.1" cy="-0.1" r="0.62">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.20" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </RadialGradient>

          {/* Top right, violet. */}
          <RadialGradient id="wlGlowB" cx="0.94" cy="0.06" r="0.55">
            <Stop offset="0" stopColor={colors.accent2} stopOpacity="0.17" />
            <Stop offset="1" stopColor={colors.accent2} stopOpacity="0" />
          </RadialGradient>

          {/* Centre, purple — fills the dead space the two corner sources
              leave in the middle of a tall phone screen. The one glow with no
              palette token of its own: it sits between accent and accent2 and
              exists only here, so a token would have exactly one consumer. */}
          <RadialGradient id="wlGlowC" cx="0.5" cy="0.46" r="0.68">
            <Stop offset="0" stopColor="#703eb2" stopOpacity="0.14" />
            <Stop offset="1" stopColor="#703eb2" stopOpacity="0" />
          </RadialGradient>
        </Defs>

        <Rect x="0" y="0" width="100" height="100" fill="url(#wlBase)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#wlGlowC)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#wlGlowA)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#wlGlowB)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  // In style rather than as a `pointerEvents` prop: the prop form is deprecated
  // in React Native 0.86 and warns on every render on web.
  layer: { pointerEvents: "none" },
});
