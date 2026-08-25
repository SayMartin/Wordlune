import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useTheme } from "../../theme/ThemeProvider";
import { glassProps } from "../../theme/webTheme";

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Opts out of transparency. For anything content can pass behind — a
   * dropdown, a modal, a sticky bar — where see-through is a bug, not a look.
   */
  solid?: boolean;
  /** Tints the border, for a card that carries a status (danger zone, a win). */
  borderColor?: string;
}

/**
 * The shared glass surface — appfinningar.se's `.glass`. Cards, panels and
 * overlays all use it, so the whole app follows a change made here.
 *
 * The fill is white at very low opacity rather than a colour of its own: that
 * way it picks up whatever the background gradient is doing behind it instead
 * of sitting on top as a flat grey plate. In light mode `colors.surface` is
 * opaque white and the effect is simply a plain card, which is the point.
 *
 * The hairline along the top edge is what actually sells it as glass. CSS does
 * it with `inset 0 1px 0`, which React Native has no equivalent for, so it's a
 * real 1px View pinned to the top.
 */
export default function Card({ children, style, solid, borderColor }: CardProps) {
  const { theme, colors, radii } = useTheme();
  const isDark = theme === "dark";

  return (
    <View
      // Blurring is pointless behind an opaque fill, so `solid` skips it too.
      {...(solid ? {} : glassProps)}
      style={[
        styles.card,
        {
          backgroundColor: solid ? colors.surfaceSolid : colors.surface,
          borderColor: borderColor ?? colors.border,
          borderRadius: radii.md,
        },
        isDark ? styles.shadowDark : styles.shadowLight,
        style,
      ]}
    >
      {isDark && !solid && (
        <View
          style={[
            styles.topHairline,
            { borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md },
          ]}
        />
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: "hidden" },
  topHairline: {
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  // `boxShadow` rather than the shadowColor/shadowOffset/shadowOpacity/
  // shadowRadius set: those are deprecated as of React Native 0.86 (they log a
  // warning on every render on web), and boxShadow works on Android too here
  // because the new architecture is enabled. Two layers, same as
  // appfinningar.se's `.glass`: a tight contact shadow plus a wide soft one
  // with negative spread, so the card lifts off the gradient without a
  // visible edge.
  //
  // The third layer there — `inset 0 1px 0` — is the topHairline View above
  // instead. RN does support inset shadows now, but a real 1px View behaves
  // identically on every target and needs no feature check.
  shadowDark: {
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.30), 0 12px 32px -12px rgba(0, 0, 0, 0.55)",
  },
  shadowLight: {
    boxShadow: "0 1px 2px rgba(15, 26, 58, 0.04), 0 6px 16px -6px rgba(15, 26, 58, 0.14)",
  },
});
