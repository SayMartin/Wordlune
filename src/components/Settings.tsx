import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import Avatar, { localAvatarUrl } from "./Avatar";
import { useAuth } from "../context/AuthContext";
import type { AppParamList } from "../navigation/types";
import {
  updatePlayerProfile,
  updatePlayerSettings,
  isDisplayNameTaken,
  suggestUniqueDisplayName,
  MAX_DISPLAY_NAME_LENGTH,
} from "../supabase/players-repository";
import Toggle from "./Toggle";
import ProfileSettingsSection from "./ProfileSettingsSection";
import Card from "./ui/Card";
import Button from "./ui/Button";
import SessionsPanel from "./SessionsPanel";
import DataPrivacyPanel from "./DataPrivacyPanel";
import DeleteAccountPanel from "./DeleteAccountPanel";
import { REDUCE_MOTION_KEY } from "../utils/localStorageKeys";

type Nav = NativeStackNavigationProp<AppParamList>;

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, colors } = useTheme();
  const { profile, session, isAuthenticated, authState, refreshProfile, loadingInitial, profileLoading } = useAuth();
  const navigation = useNavigation<Nav>();

  const [isEditing, setIsEditing] = useState(false);
  const [showGuestHint, setShowGuestHint] = useState(false);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<{ theme: "light" | "dark"; language: string; reduceMotion: boolean } | null>(null);

  const [isPublic, setIsPublic] = useState(false);
  const [avatarSeed, setAvatarSeed] = useState("");
  const [useRandomAvatar, setUseRandomAvatar] = useState(false);

  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(REDUCE_MOTION_KEY).then((v) => {
      if (v === "1") setReduceMotion(true);
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(REDUCE_MOTION_KEY, reduceMotion ? "1" : "0").catch(() => {});
  }, [reduceMotion]);

  const { display_name, avatar_url, is_public: profileIsPublic } = profile || {};
  const email = session?.user?.email;

  useEffect(() => {
    if (authState === "registered" && profile?.metadata?.settings) {
      const savedSettings = profile.metadata.settings;
      if (savedSettings.theme && savedSettings.theme !== theme && (savedSettings.theme === "light" || savedSettings.theme === "dark")) {
        setTheme(savedSettings.theme);
      }
      if (savedSettings.language && savedSettings.language !== i18n.language) {
        i18n.changeLanguage(savedSettings.language);
      }
      if (typeof savedSettings.reduceMotion === "boolean" && savedSettings.reduceMotion !== reduceMotion) {
        setReduceMotion(savedSettings.reduceMotion);
      }
    }
    setOriginalSettings({ theme, language: i18n.language || "en", reduceMotion });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, authState]);

  const handleLanguageChange = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  const handleThemeOption = (t2: "light" | "dark") => {
    setTheme(t2);
  };

  const handleReduceMotionChange = () => {
    setReduceMotion((v) => !v);
  };

  const settingsChanged =
    !!originalSettings &&
    (originalSettings.theme !== theme ||
      originalSettings.language !== i18n.language ||
      originalSettings.reduceMotion !== reduceMotion);

  const handleSaveSettings = async () => {
    if (!settingsChanged) return;

    setSettingsLoading(true);
    try {
      if (authState === "registered" && profile) {
        await updatePlayerSettings(profile.id, { theme, language: i18n.language, reduceMotion });
        await refreshProfile();
      } else {
        // No backend write for guests — hold the "Saving..." state briefly
        // so the transition to "Settings Saved" is perceivable, matching
        // the registered-user path instead of jumping instantly.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      setOriginalSettings({ theme, language: i18n.language, reduceMotion });
    } catch (err) {
      console.error("Failed to save settings", err);
    } finally {
      setSettingsLoading(false);
    }
  };

  const handleCancelSettings = () => {
    if (originalSettings) {
      if (originalSettings.theme !== theme) setTheme(originalSettings.theme);
      if (originalSettings.language !== i18n.language) i18n.changeLanguage(originalSettings.language);
      if (originalSettings.reduceMotion !== reduceMotion) setReduceMotion(originalSettings.reduceMotion);
    }
  };

  const currentAvatarSrc = useMemo(() => {
    if (isEditing && useRandomAvatar) {
      return localAvatarUrl(avatarSeed);
    }
    return avatar_url || localAvatarUrl(display_name || "guest");
  }, [isEditing, useRandomAvatar, avatarSeed, avatar_url, display_name]);

  if (loadingInitial || (isAuthenticated && !profile && profileLoading)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <Text style={[styles.center, { color: colors.textMuted }]}>
        {t("login_to_view_profile", { defaultValue: "Please log in to view your profile." })}
      </Text>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <Text style={[styles.error, { color: colors.danger }]}>
          {t("profile_load_failed", { defaultValue: "Couldn't load your profile." })}
        </Text>
        <Button
          size="sm"
          variant="ghost"
          label={t("retry", { defaultValue: "Retry" })}
          onPress={refreshProfile}
        />
      </View>
    );
  }

  const handleEditClick = () => {
    if (authState !== "registered") {
      setShowGuestHint(true);
      return;
    }
    setEditName(display_name || "");
    setIsPublic(profileIsPublic === true);
    setUseRandomAvatar(false);
    setAvatarSeed("");
    setIsEditing(true);
    setShowGuestHint(false);
  };

  const randomizeAvatar = () => {
    setUseRandomAvatar(true);
    setAvatarSeed(Math.random().toString(36).substring(7));
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setError(t("error_empty_display_name", { defaultValue: "Display name cannot be empty" }));
      return;
    }
    if (editName.length > MAX_DISPLAY_NAME_LENGTH) {
      setError(t("username_max_length", { defaultValue: `Maximum ${MAX_DISPLAY_NAME_LENGTH} characters allowed`, length: MAX_DISPLAY_NAME_LENGTH }));
      return;
    }
    setLoading(true);
    setError(null);

    try {
      if (editName !== display_name) {
        const taken = await isDisplayNameTaken(editName);
        if (taken) {
          const suggestion = await suggestUniqueDisplayName(editName);
          setError(t("error_name_taken", { suggestion, defaultValue: `Name taken. Try: ${suggestion}` }));
          setLoading(false);
          return;
        }
      }

      let newAvatarUrl = avatar_url;
      if (useRandomAvatar) {
        newAvatarUrl = localAvatarUrl(avatarSeed);
      }

      await updatePlayerProfile(profile.id, {
        display_name: editName,
        avatar_url: newAvatarUrl,
        is_public: isPublic,
      });

      await refreshProfile();
      setIsEditing(false);
    } catch (err) {
      setError(t("error_profile_update_failed", { defaultValue: "Failed to update profile" }));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <Card style={styles.card}>
      <Text style={[styles.cardTitle, { color: colors.accent }]}>{t("my_profile", { defaultValue: "My Profile" })}</Text>
      <View style={styles.headerRow}>
        <View style={styles.avatarCol}>
          <Avatar uri={currentAvatarSrc} fallbackSeed={profile?.display_name} size={64} />
          {isEditing && (
            <Pressable onPress={randomizeAvatar}>
              <Text style={[styles.link, { color: colors.accent }]}>
                {t("randomize", { defaultValue: "Randomize" })}
              </Text>
            </Pressable>
          )}
        </View>

        <View style={styles.headerMain}>
          {isEditing ? (
            <View style={{ gap: 6 }}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{t("display_name", { defaultValue: "Display Name" })}</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                editable={!loading}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceSunken,
                    borderColor: colors.border,
                    color: colors.text,
                  },
                ]}
                placeholderTextColor={colors.textMuted}
                placeholder={t("display_name", { defaultValue: "Display Name" }) as string}
              />
              {editName.length === MAX_DISPLAY_NAME_LENGTH && (
                <Text style={[styles.warning, { color: colors.warning }]}>
                  {t("username_max_length", { defaultValue: `Maximum ${MAX_DISPLAY_NAME_LENGTH} characters allowed`, length: MAX_DISPLAY_NAME_LENGTH })}
                </Text>
              )}
              {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
              <View style={{ marginTop: 8 }}>
                <Toggle checked={isPublic} onChange={setIsPublic} label={t("make_public_label", { defaultValue: "Make profile public (Highscores visible)" })} />
              </View>
            </View>
          ) : (
            <>
              <Text style={[styles.displayName, { color: colors.text }]}>{display_name}</Text>
              <Text style={[styles.email, { color: colors.textMuted }]}>{email}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.statsSection}>
        <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("privacy_status", { defaultValue: "Leaderboard Visibility" })}</Text>
          <Text style={[styles.statValue, { color: profileIsPublic ? colors.success : colors.text }]}>
            {profileIsPublic ? t("public", { defaultValue: "Public" }) : t("private", { defaultValue: "Private" })}
          </Text>
        </View>
        <View style={[styles.statRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t("joined", { defaultValue: "Joined" })}</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {isEditing ? (
          <View style={styles.row}>
            <Button
              size="sm"
              loading={loading}
              label={t("save_profile", { defaultValue: "Save Profile" })}
              onPress={handleSave}
            />
            <Button
              size="sm"
              variant="ghost"
              disabled={loading}
              label={t("cancel", { defaultValue: "Cancel" })}
              onPress={() => {
                setIsEditing(false);
                setError(null);
              }}
            />
          </View>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            label={t("edit_profile", { defaultValue: "Edit Profile" })}
            onPress={handleEditClick}
          />
        )}
      </View>

      {showGuestHint && (
        // Covers the card it belongs to, so it must be opaque — the whole point
        // is that the profile fields behind it are not available right now.
        <View style={[styles.guestOverlay, { backgroundColor: colors.surfaceSolid }]}>
          <Text style={[styles.guestTitle, { color: colors.text }]}>
            {t("guest_limitation_title", { defaultValue: "Guest Limitation" })}
          </Text>
          <Text style={[styles.guestMessage, { color: colors.textMuted }]}>
            {t("guest_limitation_msg", { defaultValue: "You need to be a registered user to edit your profile." })}
          </Text>
          <View style={styles.row}>
            <Button
              size="sm"
              label={t("signup", { defaultValue: "Sign Up" })}
              onPress={() => navigation.navigate("Signup")}
            />
            <Button
              size="sm"
              variant="subtle"
              label={t("close", { defaultValue: "Close" })}
              onPress={() => setShowGuestHint(false)}
            />
          </View>
        </View>
      )}
    </Card>

    <ProfileSettingsSection
      currentLanguage={i18n.language}
      onLanguageChange={handleLanguageChange}
      theme={theme}
      onThemeChange={handleThemeOption}
      reduceMotion={reduceMotion}
      onReduceMotionChange={handleReduceMotionChange}
      authState={authState}
      loading={settingsLoading}
      canSave={settingsChanged}
      onSave={handleSaveSettings}
      onCancel={handleCancelSettings}
    />

    <SessionsPanel />

    <DataPrivacyPanel />

    <DeleteAccountPanel />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  cardTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  card: { padding: 18, gap: 4, position: "relative" },
  headerRow: { flexDirection: "row", gap: 14, marginBottom: 12 },
  avatarCol: { alignItems: "center", gap: 6 },
  headerMain: { flex: 1, justifyContent: "center" },
  displayName: { fontSize: 20, fontWeight: "800" },
  email: { fontSize: 13 },
  fieldLabel: { fontSize: 11, fontWeight: "700" },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8 },
  warning: { fontSize: 11 },
  error: { fontSize: 13 },
  link: { textDecorationLine: "underline", fontSize: 12 },
  statsSection: { marginTop: 8, gap: 8 },
  statRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, paddingBottom: 8 },
  statLabel: { fontWeight: "600" },
  statValue: { fontWeight: "700" },
  actions: { marginTop: 16 },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center" },
  guestOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  guestTitle: { fontWeight: "800", fontSize: 16 },
  guestMessage: { textAlign: "center", fontSize: 13 },
});
