import React, { useId } from "react";
import { Platform, StyleSheet, Text, View, type StyleProp, type TextStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTheme } from "../../theme/ThemeProvider";

const isWeb = Platform.OS === "web";

// Renders `data-wl-gradient-text` on web, which webTheme.ts styles with
// background-clip: text — the top of the heading near-white, the bottom
// duller. React Native can't clip a fill to glyphs, so native gets flat
// `colors.text` instead; it's a refinement, not the identity.
const gradientTextProps = isWeb ? ({ dataSet: { wlGradientText: "true" } } as const) : ({} as const);

interface PageTitleProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

/** The h1 of a screen. One per screen. */
export function PageTitle({ children, style }: PageTitleProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...gradientTextProps}
      accessibilityRole="header"
      style={[styles.pageTitle, { color: colors.text }, style]}
    >
      {children}
    </Text>
  );
}

interface SectionHeadingProps {
  children: string;
  style?: StyleProp<TextStyle>;
}

/**
 * A centred section label with a short rule under it that fades out at both
 * ends and shifts blue→violet in the middle — appfinningar.se's
 * `.section-heading::after`, which is how a new section starts on that site.
 */
export function SectionHeading({ children, style }: SectionHeadingProps) {
  const { colors } = useTheme();
  // Unique per instance — see Button.tsx for why a shared gradient id breaks.
  const gradientId = `wlRule${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View style={styles.sectionWrap}>
      <Text
        accessibilityRole="header"
        style={[styles.sectionHeading, { color: colors.text }, style]}
      >
        {children}
      </Text>
      <View style={styles.rule}>
        <Svg width="100%" height="2" viewBox="0 0 100 2" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.accent} stopOpacity="0" />
              <Stop offset="0.35" stopColor={colors.accent} stopOpacity="1" />
              <Stop offset="0.65" stopColor={colors.accent2} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.accent2} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="2" rx="1" fill={`url(#${gradientId})`} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pageTitle: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  sectionWrap: { alignItems: "center", gap: 12, marginTop: 8, marginBottom: 16 },
  sectionHeading: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: -0.3,
    textAlign: "center",
  },
  rule: { width: 72, height: 2 },
});
