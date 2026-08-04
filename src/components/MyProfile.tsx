import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import {
  updatePlayerProfile,
  updatePlayerSettings,
  isDisplayNameTaken,
  suggestUniqueDisplayName,
  MAX_DISPLAY_NAME_LENGTH,
} from "../supabase/players-repository";
import Toggle from "./Toggle";
import ProfileSettingsSection from "./ProfileSettingsSection";

const REDUCE_MOTION_KEY = "wordse:reduceMotion";

export default function MyProfile() {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { profile, session, isAuthenticated, authState, refreshProfile, loadingInitial } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [showGuestHint, setShowGuestHint] = useState(false);
  const [editName, setEditName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
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
    setSettingsSaved(false);
  };

  const handleThemeOption = (t2: "light" | "dark") => {
    setTheme(t2);
    setSettingsSaved(false);
  };

  const handleReduceMotionChange = () => {
    setReduceMotion((v) => !v);
    setSettingsSaved(false);
  };

  const handleSaveSettings = async () => {
    setSettingsLoading(true);
    setSettingsSaved(false);

    if (authState === "registered" && profile) {
      try {
        await updatePlayerSettings(profile.id, { theme, language: i18n.language, reduceMotion });
        await refreshProfile();
        setSettingsSaved(true);
        setOriginalSettings({ theme, language: i18n.language, reduceMotion });
      } catch (err) {
        console.error("Failed to save settings", err);
      }
    } else {
      setSettingsSaved(true);
      setOriginalSettings({ theme, language: i18n.language, reduceMotion });
    }
    setSettingsLoading(false);
    setTimeout(() => setSettingsSaved(false), 3000);
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
      return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`;
    }
    return avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(display_name || "guest")}`;
  }, [isEditing, useRandomAvatar, avatarSeed, avatar_url, display_name]);

  if (loadingInitial || (isAuthenticated && !profile)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!isAuthenticated || !profile) {
    return (
      <Text style={styles.center}>{t("login_to_view_profile", { defaultValue: "Please log in to view your profile." })}</Text>
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
        newAvatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(avatarSeed)}`;
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
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.avatarCol}>
          <Image source={{ uri: currentAvatarSrc }} style={styles.avatar} />
          {isEditing && (
            <Pressable onPress={randomizeAvatar}>
              <Text style={styles.link}>{t("randomize", { defaultValue: "Randomize" })}</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.headerMain}>
          {isEditing ? (
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>{t("display_name", { defaultValue: "Display Name" })}</Text>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                maxLength={MAX_DISPLAY_NAME_LENGTH}
                editable={!loading}
                style={styles.input}
                placeholder={t("display_name", { defaultValue: "Display Name" }) as string}
              />
              {editName.length === MAX_DISPLAY_NAME_LENGTH && (
                <Text style={styles.warning}>
                  {t("username_max_length", { defaultValue: `Maximum ${MAX_DISPLAY_NAME_LENGTH} characters allowed`, length: MAX_DISPLAY_NAME_LENGTH })}
                </Text>
              )}
              {error && <Text style={styles.error}>{error}</Text>}
              <View style={{ marginTop: 8 }}>
                <Toggle checked={isPublic} onChange={setIsPublic} label={t("make_public_label", { defaultValue: "Make profile public (Highscores visible)" })} />
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.displayName}>{display_name}</Text>
              <Text style={styles.email}>{email}</Text>
            </>
          )}
        </View>
      </View>

      <View style={styles.statsSection}>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>{t("privacy_status", { defaultValue: "Privacy Status" })}</Text>
          <Text style={[styles.statValue, { color: profileIsPublic ? "#16a34a" : "#f8fafc" }]}>
            {profileIsPublic ? t("public", { defaultValue: "Public" }) : t("private", { defaultValue: "Private" })}
          </Text>
        </View>
        <View style={styles.statRow}>
          <Text style={styles.statLabel}>{t("joined", { defaultValue: "Joined" })}</Text>
          <Text style={styles.statValue}>{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : "-"}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {isEditing ? (
          <View style={styles.row}>
            <Pressable style={[styles.primaryButton, loading && styles.disabled]} onPress={handleSave} disabled={loading}>
              <Text style={styles.primaryButtonText}>
                {loading ? t("saving", { defaultValue: "Saving..." }) : t("save_profile", { defaultValue: "Save Profile" })}
              </Text>
            </Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => { setIsEditing(false); setError(null); }} disabled={loading}>
              <Text style={styles.secondaryButtonText}>{t("cancel", { defaultValue: "Cancel" })}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={styles.secondaryButton} onPress={handleEditClick}>
            <Text style={styles.secondaryButtonText}>{t("edit_profile", { defaultValue: "Edit Profile" })}</Text>
          </Pressable>
        )}
      </View>

      <ProfileSettingsSection
        currentLanguage={i18n.language}
        onLanguageChange={handleLanguageChange}
        theme={theme}
        onThemeChange={handleThemeOption}
        reduceMotion={reduceMotion}
        onReduceMotionChange={handleReduceMotionChange}
        authState={authState}
        loading={settingsLoading}
        saved={settingsSaved}
        onSave={handleSaveSettings}
        onCancel={handleCancelSettings}
      />

      {showGuestHint && (
        <View style={styles.guestOverlay}>
          <Text style={styles.guestTitle}>{t("guest_limitation_title", { defaultValue: "Guest Limitation" })}</Text>
          <Text style={styles.guestMessage}>
            {t("guest_limitation_msg", { defaultValue: "You need to be a registered user to edit your profile." })}
          </Text>
          <Pressable style={styles.linkButton} onPress={() => setShowGuestHint(false)}>
            <Text style={styles.link}>{t("close", { defaultValue: "Close" })}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, color: "#94a3b8" },
  card: { backgroundColor: "#334155", borderRadius: 12, padding: 20, position: "relative" },
  headerRow: { flexDirection: "row", gap: 14, marginBottom: 12 },
  avatarCol: { alignItems: "center", gap: 6 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#e5e7eb" },
  headerMain: { flex: 1, justifyContent: "center" },
  displayName: { fontSize: 20, fontWeight: "800", color: "#ffffff" },
  email: { fontSize: 13, color: "#e2e8f0" },
  fieldLabel: { fontSize: 11, fontWeight: "700", color: "#e2e8f0" },
  input: { backgroundColor: "#ffffff", borderRadius: 6, paddingHorizontal: 10, paddingVertical: 8, color: "#111827" },
  warning: { color: "#fdba74", fontSize: 11 },
  error: { color: "#fca5a5", fontSize: 13 },
  link: { color: "#bfdbfe", textDecorationLine: "underline", fontSize: 12 },
  linkButton: { marginTop: 4 },
  statsSection: { marginTop: 8, gap: 8 },
  statRow: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.2)", paddingBottom: 8 },
  statLabel: { color: "#e2e8f0", fontWeight: "600" },
  statValue: { color: "#ffffff", fontWeight: "700" },
  actions: { marginTop: 16 },
  row: { flexDirection: "row", gap: 8 },
  primaryButton: { backgroundColor: "#2563eb", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  primaryButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  secondaryButton: { backgroundColor: "#6b7280", paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  secondaryButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 13 },
  disabled: { opacity: 0.5 },
  guestOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15,23,42,0.95)",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 8,
  },
  guestTitle: { color: "#ffffff", fontWeight: "800", fontSize: 16 },
  guestMessage: { color: "#e2e8f0", textAlign: "center", fontSize: 13 },
});
