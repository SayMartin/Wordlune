import React from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";

// Built by concatenation rather than a literal string, so the address doesn't
// appear verbatim in the page source for simple scrapers to harvest.
const SUPPORT_EMAIL = ["support", "appfinningar.se"].join("@");

// Ported from Wordse's src/pages/About.tsx — same three sections (intro,
// game modes, account/access tiers), same i18n keys.
export default function AboutScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.container}>
      <View>
        <Text style={[styles.pageTitle, { color: colors.text }]}>{t("about", { defaultValue: "About" })}</Text>
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          {t("about_description", {
            app: "Wordlune",
            defaultValue: "Wordlune is a word puzzle game designed to test your vocabulary and problem-solving skills.",
          })}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: "#6366f1" }]}>
          {t("game_modes_title", { defaultValue: "Game Modes" })}
        </Text>

        <View style={styles.modeBlock}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>
            ☕ {t("practice_mode", { defaultValue: "Practice Mode" })}
          </Text>
          <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
            {t("practice_desc", {
              defaultValue: "Play at your own pace with customizable rules, tailored to your learning needs.",
            })}
          </Text>
          <BulletList
            color={colors.textMuted}
            items={[
              t("practice_feat_1", { defaultValue: "Choose specific categories (e.g., Animals, Geography)" }),
              t("practice_feat_2", { defaultValue: "Adjust word length (2-12 letters)" }),
              t("practice_feat_3", { defaultValue: "Scores are saved to your personal history (requires login)" }),
            ]}
          />
        </View>

        <View style={[styles.modeBlock, styles.modeBlockDivider, { borderTopColor: colors.border }]}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>
            🏆 {t("competitive_mode", { defaultValue: "Competitive Mode" })}
          </Text>
          <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
            {t("competitive_desc", { defaultValue: "Compete against others in daily challenges curated by the team." })}
          </Text>
          <BulletList
            color={colors.textMuted}
            items={[
              t("comp_feat_1", { defaultValue: "Pre-selected words and categories" }),
              t("comp_feat_2", { defaultValue: "Time and guess-count based scoring" }),
              t("comp_feat_3", { defaultValue: "Global leaderboards (Registered players only)" }),
            ]}
          />
        </View>

        <View style={[styles.modeBlock, styles.modeBlockDivider, { borderTopColor: colors.border }]}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>
            ⚔️ {t("duel_lobby_title", { defaultValue: "Duel Mode" })}
          </Text>
          <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
            {t("duel_description", {
              defaultValue: "Face off against another player in real-time. Be the first to solve the word!",
            })}
          </Text>
          <BulletList
            color={colors.textMuted}
            items={[
              t("duel_feat_1", { defaultValue: "Real-time 1v1 — both players guess the same secret word at once" }),
              t("duel_feat_2", { defaultValue: "Scored by correct and present letters as you type" }),
              t("duel_feat_3", { defaultValue: "Open to Guests and Registered players alike" }),
            ]}
          />
        </View>
      </View>

      <View style={[styles.card, styles.accessCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: "#3b82f6" }]}>
          {t("account_types_title", { defaultValue: "Account & Access" })}
        </Text>

        <View style={styles.tierGrid}>
          <View style={[styles.tierCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.tierTitle, { color: colors.textMuted }]}>
              👋 {t("visitor", { defaultValue: "Visitor" })}
            </Text>
            <BulletList
              color={colors.textMuted}
              items={[
                t("visitor_desc_1", { defaultValue: "Browse Home & About" }),
                t("visitor_desc_2", { defaultValue: "Cannot play games" }),
              ]}
            />
          </View>

          <View style={[styles.tierCard, { backgroundColor: colors.background, borderColor: "#16a34a55" }]}>
            <Text style={[styles.tierTitle, { color: "#16a34a" }]}>
              👤 {t("guest", { defaultValue: "Guest" })}
            </Text>
            <BulletList
              color={colors.textMuted}
              items={[
                t("guest_desc_1", { defaultValue: "Play Practice Mode" }),
                t("guest_desc_2", { defaultValue: "Persistence is mix of local storage and backend." }),
                t("guest_desc_3", { defaultValue: "Some data will be lost if e.g. browser data is cleared." }),
                t("guest_desc_6", { defaultValue: "Can delete your account and all its data anytime" }),
                t("guest_desc_7", { defaultValue: "Inactive guest accounts are automatically deleted after 14 days" }),
              ]}
            />
            <BulletList
              color={colors.textMuted}
              strikethrough
              items={[
                t("guest_desc_4", { defaultValue: "Competitive Mode" }),
                t("guest_desc_5", { defaultValue: "Manage Profile" }),
              ]}
            />
          </View>

          <View style={[styles.tierCard, { backgroundColor: colors.background, borderColor: "#6366f155" }]}>
            <Text style={[styles.tierTitle, { color: "#6366f1" }]}>
              ⭐ {t("registered", { defaultValue: "Registered" })}
            </Text>
            <BulletList
              color={colors.textMuted}
              items={[
                t("reg_desc_1", { defaultValue: "Unlimited Practice" }),
                t("reg_desc_2", { defaultValue: "Participate in Challenges" }),
                t("reg_desc_3", { defaultValue: "Publish Scores to Leaderboards" }),
                t("reg_desc_4", { defaultValue: "Save Scores & Progress" }),
                t("reg_desc_5", { defaultValue: "Manage Profile" }),
                t("reg_desc_6", { defaultValue: "Persistence to a PostgreSQL backend" }),
                t("reg_desc_7", { defaultValue: "Cross-device sync" }),
                t("reg_desc_8", { defaultValue: "Can delete your account and all its data anytime" }),
              ]}
            />
          </View>
        </View>
      </View>

      <View style={styles.supportRow}>
        <Text style={[styles.supportText, { color: colors.textMuted }]}>
          {t("support_contact", { defaultValue: "Need help? Contact us at" })}{" "}
        </Text>
        <Text
          accessibilityRole="link"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          style={[styles.supportText, styles.supportLink, { color: colors.accent }]}
        >
          {SUPPORT_EMAIL}
        </Text>
      </View>
    </ScrollView>
  );
}

function BulletList({
  items,
  color,
  strikethrough = false,
}: {
  items: string[];
  color: string;
  strikethrough?: boolean;
}) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <Text key={i} style={[styles.bulletItem, { color }, strikethrough && styles.strikethrough]}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 20 },
  pageTitle: { fontSize: 26, fontWeight: "800", marginBottom: 8 },
  intro: { fontSize: 16, lineHeight: 22 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: "800", marginBottom: 8 },
  modeBlock: { gap: 6 },
  modeBlockDivider: { borderTopWidth: 1, paddingTop: 14, marginTop: 8 },
  modeTitle: { fontSize: 16, fontWeight: "700" },
  modeDesc: { fontSize: 14, lineHeight: 20 },
  accessCard: { gap: 12 },
  tierGrid: { gap: 12 },
  tierCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 8 },
  tierTitle: { fontSize: 15, fontWeight: "800" },
  bulletList: { gap: 4 },
  bulletItem: { fontSize: 13, lineHeight: 19 },
  strikethrough: { textDecorationLine: "line-through", opacity: 0.6 },
  supportRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  supportText: { fontSize: 14 },
  supportLink: { fontWeight: "700", textDecorationLine: "underline" },
});
