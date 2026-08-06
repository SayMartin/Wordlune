import React from "react";
import { Platform, StyleSheet, View } from "react-native";

// Centers screen content at Wordse's `max-w-4xl` (896px) column on web,
// matching the original site's desktop layout. No-op on native.
export default function WebCentered({ children }: { children: React.ReactNode }) {
  if (Platform.OS !== "web") return <>{children}</>;
  return <View style={styles.content}>{children}</View>;
}

const styles = StyleSheet.create({
  content: { flex: 1, width: "100%", maxWidth: 896, alignSelf: "center" },
});
