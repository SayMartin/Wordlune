import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import { updatePlayerSettings } from "../supabase/players-repository";
import Logo from "./Logo";
import WavingHand from "./WavingHand";

const MAX_WIDTH = 896; // matches Wordse's `max-w-4xl` container
const MOBILE_BREAKPOINT = 768; // matches Tailwind's `md` breakpoint

function flagFor(lang: string) {
  const code = lang.split("-")[0];
  if (code.startsWith("sv")) return "🇸🇪";
  if (code.startsWith("en")) return "🇬🇧";
  return "🌐";
}

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
    const nextLang = lang.startsWith("en") ? "sv" : "en";
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

  const links = state.routes.map((route) => ({
    name: route.name,
    label: (descriptors[route.key].options.title as string) || route.name,
    isActive: route.name === activeRouteName,
  }));

  const goToTab = (name: string) => {
    setMenuOpen(false);
    navigation.navigate(name);
  };

  const authAction = isLoggedIn
    ? { label: t("logout", { defaultValue: "Log Out" }), onPress: () => nav.navigate("Signout") }
    : { label: t("login", { defaultValue: "Log In" }), onPress: () => nav.navigate("Login") };

  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <View style={styles.inner}>
        <View style={styles.side}>
          <Pressable style={styles.brand} onPress={() => goToTab("Home")}>
            <Logo size={32} />
            <Text style={[styles.brandText, { color: colors.text }]}>Wordse</Text>
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
            {links.map((link, i) => (
              <React.Fragment key={link.name}>
                {i > 0 && <Text style={{ color: colors.textMuted }}>|</Text>}
                <Pressable onPress={() => goToTab(link.name)}>
                  <Text
                    style={[
                      styles.navLink,
                      { color: colors.accent },
                      link.isActive && styles.navLinkActive,
                    ]}
                  >
                    {link.label}
                  </Text>
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        )}

        <View style={[styles.side, styles.sideEnd]}>
          <View style={styles.greetingRow}>
            <WavingHand />
            <Text style={[styles.greeting, { color: colors.text }]} numberOfLines={1}>
              {greetingLabel}
            </Text>
          </View>

          {!isMobile && (
            <Pressable
              style={[styles.authButton, { borderColor: colors.border }]}
              onPress={authAction.onPress}
            >
              <Text style={[styles.authButtonText, { color: colors.accent }]}>{authAction.label}</Text>
            </Pressable>
          )}

          {isMobile && (
            <Pressable
              style={[styles.menuButton, { borderColor: colors.border }]}
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
          <View style={[styles.dropdown, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {links.map((link) => (
              <Pressable key={link.name} style={styles.dropdownItem} onPress={() => goToTab(link.name)}>
                <Text style={[styles.dropdownText, { color: link.isActive ? colors.accent : colors.text }]}>
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
  bar: { borderBottomWidth: 1, position: "relative", zIndex: 10 },
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
  centerLinks: { flexDirection: "row", alignItems: "center", gap: 10 },
  navLink: { fontSize: 13, fontWeight: "600" },
  navLinkActive: { fontWeight: "800", textDecorationLine: "underline" },
  greetingRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  greeting: { fontWeight: "600", fontSize: 13, maxWidth: 140 },
  authButton: { borderWidth: 1, borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  authButtonText: { fontWeight: "700", fontSize: 13 },
  menuButton: { borderWidth: 1, borderRadius: 6, width: 36, height: 36, alignItems: "center", justifyContent: "center" },
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
