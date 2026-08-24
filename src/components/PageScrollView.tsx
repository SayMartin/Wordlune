import React from "react";
import { Platform, ScrollView, StyleSheet, type ScrollViewProps } from "react-native";

const isWeb = Platform.OS === "web";

// The 896px reading column, same value as Wordse's `max-w-4xl`. Kept here rather
// than imported from WebCentered because this is now the primary definition —
// WebCentered only still applies it to the two screens that have no ScrollView.
export const WEB_COLUMN_MAX_WIDTH = 896;

/**
 * The outer ScrollView for a screen.
 *
 * Exists to put the width limit on the *scrolled content* instead of on the
 * scroll container. The screens used to be wrapped in <WebCentered>, which made
 * the ScrollView itself 896px wide — so the scrollbar sat at the column's edge
 * in the middle of the viewport, and the mouse wheel did nothing at all while
 * the pointer was outside that column. On a wide desktop window that is most of
 * the screen, and it reads as the page being broken.
 *
 * Here the scroll container fills the viewport width (so wheel events anywhere
 * in x scroll it, and the scrollbar sits at the window edge) while the content
 * container keeps the 896px measure. Visually identical, behaves the way a web
 * page is expected to.
 *
 * This is not window scrolling — the page body still cannot scroll, because
 * @react-navigation/bottom-tabs renders every scene with StyleSheet.absoluteFill
 * inside a container with overflow: 'hidden' (see BottomTabView), so absolutely
 * positioned scenes never contribute height to <body>. Changing that would mean
 * replacing the navigator, which is a much larger change than this one.
 *
 * No-op on native, where the screen is narrower than the column anyway.
 */
export default function PageScrollView({ contentContainerStyle, ...rest }: ScrollViewProps) {
  return (
    <ScrollView
      {...rest}
      // Column style first so a screen's own contentContainerStyle still wins on
      // any property it sets (padding, gap, alignItems, ...).
      contentContainerStyle={[isWeb && styles.webColumn, contentContainerStyle]}
    />
  );
}

const styles = StyleSheet.create({
  webColumn: { width: "100%", maxWidth: WEB_COLUMN_MAX_WIDTH, alignSelf: "center" },
});
