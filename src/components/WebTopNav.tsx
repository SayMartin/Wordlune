import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { useTranslation } from "react-i18next";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "../theme/ThemeProvider";
import { glassProps } from "../theme/webTheme";
import { useAuth } from "../context/AuthContext";
import { updatePlayerSettings } from "../supabase/players-repository";
import { flagFor, nextLanguage } from "../utils/languageCycle";
import Logo from "./Logo";
import AuthStatusIcon from "./AuthStatusIcon";

const MAX_WIDTH = 896; // matches Wordse's `max-w-4xl` container
const MOBILE_BREAKPOINT = 768; // matches Tailwind's `md` breakpoint

// Replaces the bottom tab bar on web with a persistent top nav bar, mirroring
// Wordse's HeaderCopy.tsx: logo, language flag, centered nav links, and an
// auth greeting/login-logout cluster — with a collapsible hamburger menu
// below the `md` breakpoint, same as the original.
export default function WebTopNav({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { authState, profile } = useAuth();
  const { width } = useWindowDimensions();
  const [menuOpen, setMenuOpen] = useState(false);
  const isMobile = width < MOBILE_BREAKPOINT;
  const lang = i18n.language || "en";

  const nav = navigation as any; // bubbles to root-stack routes (Signin/Signup/Signout) too

  const toggleLanguage = async () => {
    const nextLang = nextLanguage(lang);
    await i18n.changeLanguage(nextLang);
    if (authState === "registered" && profile?.id) {
      await updatePlayerSettings(profile.id, { language: nextLang });
    }
  };

  const greetingLabel =
    authState === "registered"
      ? profile?.display_name || t("player", { defaultValue: "Player" })
      : authState === "guest"
        ? `${t("guest", { defaultValue: "Guest" })}: ${profile?.display_name || t("guest", { defaultValue: "Guest" })}`
        : t("visitor", { defaultValue: "Visitor" });

  const isLoggedIn = authState === "registered" || authState === "guest";
  const activeRouteName = state.routes[state.index].name;

  // Mirrors SessionGate's gating: Game/Progress/Settings require at least a
  // guest session, so flag them with a lock for visitors rather than letting
  // the link look like any other and only revealing that on click.
  const GATED_ROUTES = new Set(["Game", "Progress", "Settings"]);

  const links = state.routes.map((route) => ({
    name: route.name,
    label: (descriptors[route.key].options.title as string) || route.name,
    isActive: route.name === activeRouteName,
    isGated: authState === "visitor" && GATED_ROUTES.has(route.name),
  }));

  const goToTab = (name: string) => {
    setMenuOpen(false);
    navigation.navigate(name);
  };

  const authAction = isLoggedIn
    ? { label: t("logout", { defaultValue: "Log Out" }), onPress: () => nav.navigate("Signout") }
    : { label: t("login", { defaultValue: "Log In" }), onPress: () => nav.navigate("Login") };

  return (
    <View {...glassProps} style={[styles.bar, { backgroundColor: colors.surface }]}>
      {/* The rule under the bar fades out towards both edges instead of
          stopping dead at them — same treatment as the header on
          appfinningar.se, drawn here because RN borders can't be gradients. */}
      <View style={styles.hairline}>
        <Svg width="100%" height="1" viewBox="0 0 100 1" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="wlNavRule" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={colors.border} stopOpacity="0" />
              <Stop offset="0.18" stopColor={colors.border} stopOpacity="1" />
              <Stop offset="0.82" stopColor={colors.border} stopOpacity="1" />
              <Stop offset="1" stopColor={colors.border} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="1" fill="url(#wlNavRule)" />
        </Svg>
      </View>

      <View style={styles.inner}>
        <View style={styles.side}>
          <Pressable style={styles.brand} onPress={() => goToTab("Home")}>
            <Logo size={32} />
            <Text style={[styles.brandText, { color: colors.text }]}>Wordlune</Text>
          </Pressable>
          <Pressable
            onPress={toggleLanguage}
            accessibilityLabel={t("toggle_language", { defaultValue: "Switch Language" })}
            hitSlop={8}
          >
            <Text style={styles.flag}>{flagFor(lang)}</Text>
          </Pressable>
        </View>

        {!isMobile && (
          <View style={styles.centerLinks}>
            {links.map((link) => (
              <Pressable
                key={link.name}
                onPress={() => goToTab(link.name)}
                style={[
                  styles.navItem,
                  { borderBottomColor: link.isActive ? colors.accent : "transparent" },
                ]}
              >
                <Text
                  style={[
                    styles.navLink,
                    { color: link.isActive ? colors.text : colors.textMuted },
                  ]}
                >
                  {link.isGated ? "🔒 " : ""}
                  {link.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <View style={[styles.side, styles.sideEnd]}>
          <View style={styles.greetingRow}>
            <AuthStatusIcon authState={authState} />
            <Text style={[styles.greeting, { color: colors.text }]} numberOfLines={1}>
              {greetingLabel}
            </Text>
          </View>

          {!isMobile && (
            <Pressable
              style={[
                styles.authButton,
                { borderColor: colors.border, backgroundColor: colors.surfaceHover },
              ]}
              onPress={authAction.onPress}
            >
              <Text style={[styles.authButtonText, { color: colors.text }]}>{authAction.label}</Text>
            </Pressable>
          )}

          {isMobile && (
            <Pressable
              style={[styles.menuButton, { borderColor: colors.border, backgroundColor: colors.surfaceHover }]}
              onPress={() => setMenuOpen((v) => !v)}
              accessibilityLabel="Toggle navigation"
            >
              <Text style={{ color: colors.text, fontSize: 16 }}>{menuOpen ? "✕" : "☰"}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {isMobile && menuOpen && (
        <>
          <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)} />
          <View style={[styles.dropdown, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
            {links.map((link) => (
              <Pressable key={link.name} style={styles.dropdownItem} onPress={() => goToTab(link.name)}>
                <Text style={[styles.dropdownText, { color: link.isActive ? colors.accent : colors.text }]}>
                  {link.isGated ? "🔒 " : ""}
                  {link.label}
                </Text>
              </Pressable>
            ))}
            <View style={[styles.dropdownDivider, { borderTopColor: colors.border }]}>
              <Pressable
                style={styles.dropdownItem}
                onPress={() => {
                  setMenuOpen(false);
                  authAction.onPress();
                }}
              >
                <Text style={[styles.dropdownText, { color: colors.accent }]}>{authAction.label}</Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { position: "relative", zIndex: 10 },
  hairline: { pointerEvents: "none", position: "absolute", left: 0, right: 0, bottom: 0, height: 1 },
  inner: {
    width: "100%",
    maxWidth: MAX_WIDTH,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  side: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  sideEnd: { justifyContent: "flex-end" },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandText: { fontSize: 18, fontWeight: "800" },
  flag: { fontSize: 20 },
  centerLinks: { flexDirection: "row", alignItems: "center", gap: 22 },
  navItem: { borderBottomWidth: 1, paddingBottom: 3 },
  navLink: { fontSize: 14, fontWeight: "600" },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  greeting: { fontWeight: "600", fontSize: 13, maxWidth: 140 },
  authButton: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14 },
  authButtonText: { fontWeight: "600", fontSize: 13 },
  menuButton: { borderWidth: 1, borderRadius: 999, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  menuBackdrop: {
    position: "fixed" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 15,
  },
  dropdown: {
    position: "absolute",
    right: 16,
    top: "100%",
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    width: 200,
    zIndex: 20,
    gap: 2,
  },
  dropdownItem: { paddingVertical: 8, paddingHorizontal: 8 },
  dropdownText: { fontSize: 14, fontWeight: "600" },
  dropdownDivider: { borderTopWidth: 1, marginTop: 4, paddingTop: 4 },
});
