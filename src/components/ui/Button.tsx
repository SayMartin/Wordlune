import React, { useId } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";

export type ButtonVariant = "primary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "sm" | "md";

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  /** Rendered before the label — an emoji or a small glyph, not an icon set. */
  icon?: string;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * The button pair from appfinningar.se: one filled with the brand gradient for
 * the action that matters, one outlined for the alternative. Never two filled
 * ones side by side — that's what `ghost` is for.
 *
 * The gradient is an SVG behind the label rather than expo-linear-gradient, so
 * this needs no extra native module (see AppBackground.tsx for the same call).
 */
export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  icon,
  fullWidth,
  style,
  accessibilityLabel,
}: ButtonProps) {
  const { colors, radii } = useTheme();
  const isDisabled = Boolean(disabled || loading);
  // Unique per instance: several SVGs in one document defining the same
  // gradient id would have every `url(#id)` resolve to whichever is first in
  // document order, so unmounting that one blanks the fill on all the others.
  const gradientId = `wlBtn${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  const fills: Record<ButtonVariant, { bg: string; border: string; fg: string }> = {
    // `primary`'s background is the SVG below; the colour here only shows in
    // the sliver outside the gradient's antialiased edge.
    primary: { bg: colors.accent, border: "transparent", fg: colors.onAccent },
    ghost: { bg: colors.surfaceHover, border: colors.border, fg: colors.text },
    danger: { bg: colors.danger, border: "transparent", fg: colors.onAccent },
    subtle: { bg: "transparent", border: "transparent", fg: colors.accent },
  };
  const fill = fills[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled, busy: Boolean(loading) }}
      style={({ pressed }) => [
        styles.base,
        size === "sm" ? styles.sizeSm : styles.sizeMd,
        {
          backgroundColor: fill.bg,
          borderColor: fill.border,
          borderRadius: radii.pill,
        },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        // Lifts 2px on press/hover, same as appfinningar.se's `.btn:hover`.
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      {variant === "primary" && !isDisabled && (
        <View style={[StyleSheet.absoluteFill, { borderRadius: radii.pill, overflow: "hidden" }]}>
          <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor={colors.accent} />
                <Stop offset="1" stopColor={colors.accent2} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="100" fill={`url(#${gradientId})`} />
          </Svg>
        </View>
      )}

      {loading ? (
        <ActivityIndicator color={fill.fg} />
      ) : (
        <>
          {icon ? <Text style={[styles.icon, { color: fill.fg }]}>{icon}</Text> : null}
          <Text
            style={[
              size === "sm" ? styles.labelSm : styles.labelMd,
              { color: fill.fg },
            ]}
            numberOfLines={1}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  sizeMd: { paddingVertical: 11, paddingHorizontal: 22, minHeight: 44 },
  sizeSm: { paddingVertical: 7, paddingHorizontal: 14, minHeight: 34 },
  fullWidth: { alignSelf: "stretch" },
  labelMd: { fontSize: 15, fontWeight: "600" },
  labelSm: { fontSize: 13, fontWeight: "600" },
  icon: { fontSize: 15 },
  disabled: { opacity: 0.45 },
  pressed: { transform: [{ translateY: -2 }] },
});
