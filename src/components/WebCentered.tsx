import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { WEB_COLUMN_MAX_WIDTH } from "./PageScrollView";

// Centers screen content at Wordse's `max-w-4xl` (896px) column on web,
// matching the original site's desktop layout. No-op on native.
//
// Only for screens with no ScrollView of their own — currently SignoutScreen and
// NotFoundScreen. Everything else gets the same measure from PageScrollView,
// which applies it to the scrolled *content* rather than to the scroll
// container. Do not wrap a PageScrollView screen in this: it would constrain the
// scroll container to 896px again, which puts the scrollbar in the middle of the
// viewport and makes the mouse wheel dead outside the column.
export default function WebCentered({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== "web") return <>{children}</>;
  return <View style={styles.content}>{children}</View>;
}

const styles = StyleSheet.create({
  content: { flex: 1, width: "100%", maxWidth: WEB_COLUMN_MAX_WIDTH, alignSelf: "center" },
});
