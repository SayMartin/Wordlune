import React from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import PageScrollView from "../components/PageScrollView";
import { useTranslation } from "react-i18next";
import { useTheme } from "../theme/ThemeProvider";
import Card from "../components/ui/Card";
import {
  CONTROLLER_NAME,
  MINIMUM_AGE,
  PRIVACY_POLICY_VERSION,
  SUPPORT_EMAIL,
} from "../constants/privacy";

// Reachable at /privacy on web (see the linking config in App.tsx), which is
// also the URL given to Google Play as the app's privacy policy. Deliberately
// NOT behind SessionGate — a visitor must be able to read it before deciding
// to create an account, and Play's reviewers need it without signing in.
//
// Structure follows GDPR Art. 13: who the controller is, what is processed on
// what legal basis, how long it's kept, who receives it, and what rights the
// reader has. Layout mirrors AboutScreen.tsx.
export default function PrivacyPolicyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  // Each category states what is processed, under which Art. 6 basis, and for
  // how long — kept together per category rather than split across three
  // separate lists, so a reader can answer "what happens to my scores?" in one
  // place instead of cross-referencing.
  const categories = [
    {
      key: "account",
      name: t("privacy_policy_data_account", { defaultValue: "Account" }),
      body: t("privacy_policy_data_account_body", {
        defaultValue:
          "Your email address, an encrypted form of your password, the display name and avatar you chose at signup, and sign-in timestamps. Guest accounts have no email address.",
      }),
      basis: t("privacy_policy_data_account_basis", {
        defaultValue: "Performance of a contract (Art. 6(1)(b)) — we cannot give you an account without it.",
      }),
    },
    {
      key: "profile",
      name: t("privacy_policy_data_profile", { defaultValue: "Profile" }),
      body: t("privacy_policy_data_profile_body", {
        defaultValue:
          "Your display name, avatar, and whether you have chosen to make your profile visible on leaderboards.",
      }),
      basis: t("privacy_policy_data_profile_basis", {
        defaultValue:
          "Performance of a contract (Art. 6(1)(b)), except leaderboard visibility, which is consent (Art. 6(1)(a)) and can be withdrawn at any time.",
      }),
    },
    {
      key: "gameplay",
      name: t("privacy_policy_data_gameplay", { defaultValue: "Gameplay" }),
      body: t("privacy_policy_data_gameplay_body", {
        defaultValue:
          "Your scores, the words you played, how many guesses you used, how long each round took, the language you played in, and your progress through challenges.",
      }),
      basis: t("privacy_policy_data_gameplay_basis", {
        defaultValue: "Performance of a contract (Art. 6(1)(b)) — this is the game history the app exists to keep.",
      }),
    },
    {
      key: "duel",
      name: t("privacy_policy_data_duel", { defaultValue: "Duels" }),
      body: t("privacy_policy_data_duel_body", {
        defaultValue:
          "For each duel, which two players took part, which word was played, and who won. Your opponent sees your display name and avatar during the duel.",
      }),
      basis: t("privacy_policy_data_duel_basis", {
        defaultValue: "Performance of a contract (Art. 6(1)(b)) — a duel cannot work without both players knowing who they are playing.",
      }),
    },
    {
      key: "settings",
      name: t("privacy_policy_data_settings", { defaultValue: "Settings" }),
      body: t("privacy_policy_data_settings_body", {
        defaultValue: "Your chosen theme, language, and reduced-motion preference.",
      }),
      basis: t("privacy_policy_data_settings_basis", {
        defaultValue: "Performance of a contract (Art. 6(1)(b)).",
      }),
    },
    {
      key: "device",
      name: t("privacy_policy_data_device", { defaultValue: "Stored on your device" }),
      body: t("privacy_policy_data_device_body", {
        defaultValue:
          "Your login session (which includes your email address), any round you have in progress, and your theme, language and reduced-motion preferences. Logging out erases the session and the round in progress; deleting your account erases all of it.",
      }),
      basis: t("privacy_policy_data_device_basis", {
        defaultValue: "Strictly necessary to provide the service you asked for.",
      }),
    },
    {
      key: "technical",
      name: t("privacy_policy_data_technical", { defaultValue: "Technical data" }),
      body: t("privacy_policy_data_technical_body", {
        defaultValue:
          "Your IP address and basic request information are handled in passing by our hosting and network providers in order to deliver the app and to protect it from abuse. We do not build profiles from this.",
      }),
      basis: t("privacy_policy_data_technical_basis", {
        defaultValue: "Legitimate interests (Art. 6(1)(f)) — keeping the service available and secure.",
      }),
    },
  ];

  const recipients = [
    t("privacy_policy_recipient_supabase", {
      defaultValue:
        "Supabase — hosts the database, accounts, and real-time duel connections. Your data is stored in Stockholm, Sweden (EU).",
    }),
    t("privacy_policy_recipient_resend", {
      defaultValue: "Resend — sends the account emails described above; receives your email address and display name.",
    }),
    t("privacy_policy_recipient_cloudflare", {
      defaultValue: "Cloudflare — delivers the website and terminates the encrypted connection.",
    }),
    t("privacy_policy_recipient_github", {
      defaultValue: "GitHub — stores the built application image. Receives no player data.",
    }),
    t("privacy_policy_recipient_google", {
      defaultValue: "Google Play — distributes the Android app. Applies only if you installed it from the Play Store.",
    }),
  ];

  const rights = [
    t("privacy_policy_right_access", {
      defaultValue: "Access — get a copy of your data. Settings → Data & Privacy → Download my data.",
    }),
    t("privacy_policy_right_rectification", {
      defaultValue: "Rectification — correct anything wrong. Settings → edit your profile.",
    }),
    t("privacy_policy_right_erasure", {
      defaultValue: "Erasure — delete your account and everything attached to it. Settings → Danger Zone.",
    }),
    t("privacy_policy_right_portability", {
      defaultValue: "Portability — the download above is machine-readable JSON you can take elsewhere.",
    }),
    t("privacy_policy_right_withdraw", {
      defaultValue: "Withdraw consent — turn leaderboard visibility off at any time, in Settings or per score.",
    }),
    t("privacy_policy_right_restriction", {
      defaultValue: "Restriction and objection — ask us to pause or stop a particular use of your data.",
    }),
  ];

  return (
    <PageScrollView contentContainerStyle={styles.container}>
      <View>
        <Text style={[styles.pageTitle, { color: colors.text }]}>
          {t("privacy_policy", { defaultValue: "Privacy Policy" })}
        </Text>
        <Text style={[styles.lastUpdated, { color: colors.textMuted }]}>
          {t("privacy_policy_last_updated", {
            date: PRIVACY_POLICY_VERSION,
            defaultValue: "Last updated: {{date}}",
          })}
        </Text>
        <Text style={[styles.intro, { color: colors.textMuted }]}>
          {t("privacy_policy_intro", {
            defaultValue:
              "This explains what Wordlune does with your personal data, why, and what you can ask us to do about it. Wordlune has no advertising, no analytics, and no tracking of any kind.",
          })}
        </Text>
      </View>

      <Section title={t("privacy_policy_controller_title", { defaultValue: "Who is responsible" })} colors={colors}>
        <Body colors={colors}>
          {t("privacy_policy_controller_body", {
            controller: CONTROLLER_NAME,
            defaultValue:
              "Wordlune is run by {{controller}}, a sole trader based in Sweden, who is the data controller for the processing described here.",
          })}
        </Body>
        <EmailLine
          colors={colors}
          label={t("privacy_policy_controller_contact", { defaultValue: "You can reach us at" })}
        />
      </Section>

      <Section title={t("privacy_policy_data_title", { defaultValue: "What we process" })} colors={colors}>
        <Body colors={colors}>
          {t("privacy_policy_data_intro", {
            defaultValue: "Each of these is kept only for as long as described under “How long we keep it” below.",
          })}
        </Body>
        {categories.map((c, i) => (
          <View
            key={c.key}
            style={[styles.categoryBlock, i > 0 && styles.categoryDivider, { borderTopColor: colors.border }]}
          >
            <Text style={[styles.categoryName, { color: colors.text }]}>{c.name}</Text>
            <Text style={[styles.categoryBody, { color: colors.textMuted }]}>{c.body}</Text>
            <Text style={[styles.categoryBasis, { color: colors.textMuted }]}>
              <Text style={styles.categoryBasisLabel}>
                {t("privacy_policy_basis_label", { defaultValue: "Legal basis:" })}{" "}
              </Text>
              {c.basis}
            </Text>
          </View>
        ))}
      </Section>

      <Section title={t("privacy_policy_leaderboard_title", { defaultValue: "Leaderboards" })} colors={colors}>
        <Body colors={colors}>
          {t("privacy_policy_leaderboard_body", {
            defaultValue:
              "Nothing appears on a public leaderboard unless you choose to publish it. Publishing a score shows your display name, your avatar and that score to anyone signed in to Wordlune.",
          })}
        </Body>
        <Body colors={colors}>
          {t("privacy_policy_leaderboard_withdraw", {
            defaultValue:
              "You can unpublish a score, or make your profile private again, at any time — that removes it from the leaderboards going forward.",
          })}
        </Body>
      </Section>

      <Section title={t("privacy_policy_retention_title", { defaultValue: "How long we keep it" })} colors={colors}>
        <BulletList
          color={colors.textMuted}
          items={[
            t("privacy_policy_retention_guest", {
              defaultValue: "Guest accounts are deleted automatically after 14 days without being used.",
            }),
            t("privacy_policy_retention_unverified", {
              defaultValue: "If you sign up but never confirm your email address, the account is deleted after 14 days.",
            }),
            t("privacy_policy_retention_inactive", {
              defaultValue:
                "If you don't sign in for 6 months, we email you a warning. If you still haven't signed in 14 days later, the account and its data are deleted.",
            }),
            t("privacy_policy_retention_self_delete", {
              defaultValue:
                "You can delete your account yourself at any time, which removes your profile, scores, challenge history and duels immediately.",
            }),
            t("privacy_policy_retention_backups", {
              defaultValue: "Deleted data may persist briefly in encrypted database backups before those expire.",
            }),
          ]}
        />
      </Section>

      <Section title={t("privacy_policy_recipients_title", { defaultValue: "Who else sees it" })} colors={colors}>
        <Body colors={colors}>
          {t("privacy_policy_recipients_intro", {
            defaultValue:
              "We do not sell your data and we do not share it for anyone else's purposes. We do rely on these providers to run the service, each bound by a data processing agreement:",
          })}
        </Body>
        <BulletList color={colors.textMuted} items={recipients} />
      </Section>

      <Section title={t("privacy_policy_transfers_title", { defaultValue: "Where your data is stored" })} colors={colors}>
        <Body colors={colors}>
          {t("privacy_policy_transfers_body", {
            defaultValue:
              "Your database and its backups are stored in Stockholm, Sweden. Supabase, which operates it, also engages sub-processors outside the EU for hosting, monitoring, security and support, and some of these can in principle access data held in the service; Supabase publishes a current list of them. Resend, which sends the account emails described above, is based in the United States, and Cloudflare routes web traffic through a global network. All of these transfers are covered by the European Commission's Standard Contractual Clauses.",
          })}
        </Body>
      </Section>

      <Section title={t("privacy_policy_rights_title", { defaultValue: "Your rights" })} colors={colors}>
        <BulletList color={colors.textMuted} items={rights} />
        <EmailLine
          colors={colors}
          label={t("privacy_policy_rights_howto", {
            defaultValue: "For anything you can't do in the app, or if you want help, write to",
          })}
        />
        <Body colors={colors}>
          {t("privacy_policy_rights_response", {
            defaultValue: "We answer requests within one month.",
          })}
        </Body>
        <Body colors={colors}>
          {t("privacy_policy_rights_complaint", {
            defaultValue:
              "If you think we've handled your data wrongly, you have the right to complain to the Swedish Authority for Privacy Protection (IMY, imy.se).",
          })}
        </Body>
      </Section>

      <Section title={t("privacy_policy_children_title", { defaultValue: "Children" })} colors={colors}>
        <Body colors={colors}>
          {t("privacy_policy_children_body", {
            age: MINIMUM_AGE,
            defaultValue:
              "Wordlune is not aimed at young children, and you must be at least {{age}} to create an account. If you believe a child has created one, contact us and we will remove it.",
          })}
        </Body>
      </Section>

      <Section title={t("privacy_policy_security_title", { defaultValue: "Security" })} colors={colors}>
        <Body colors={colors}>
          {t("privacy_policy_security_body", {
            defaultValue:
              "All traffic is encrypted in transit. Passwords are stored only as salted hashes, never in readable form. Access to the database is restricted so that each account can only reach its own data.",
          })}
        </Body>
      </Section>

      <Section title={t("privacy_policy_cookies_title", { defaultValue: "Cookies" })} colors={colors}>
        <Body colors={colors}>
          {t("privacy_policy_cookies_body", {
            defaultValue:
              "Wordlune sets no cookies and uses no tracking scripts. It stores your login session and preferences on your own device, which is necessary for the app to work and is why you are not asked to consent to it.",
          })}
        </Body>
      </Section>

      <Section title={t("privacy_policy_changes_title", { defaultValue: "Changes to this policy" })} colors={colors}>
        <Body colors={colors}>
          {t("privacy_policy_changes_body", {
            defaultValue:
              "If this policy changes in a way that matters, we'll update the date at the top and let you know in the app the next time you sign in.",
          })}
        </Body>
      </Section>

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
    </PageScrollView>
  );
}

function Section({
  title,
  colors,
  children,
}: {
  title: string;
  colors: { accent: string };
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.card}>
      <Text style={[styles.cardTitle, { color: colors.accent }]}>{title}</Text>
      {children}
    </Card>
  );
}

function Body({ colors, children }: { colors: { textMuted: string }; children: React.ReactNode }) {
  return <Text style={[styles.body, { color: colors.textMuted }]}>{children}</Text>;
}

function EmailLine({ colors, label }: { colors: { textMuted: string; accent: string }; label: string }) {
  return (
    <View style={styles.emailRow}>
      <Text style={[styles.body, { color: colors.textMuted }]}>{label} </Text>
      <Text
        accessibilityRole="link"
        onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
        style={[styles.body, styles.supportLink, { color: colors.accent }]}
      >
        {SUPPORT_EMAIL}
      </Text>
    </View>
  );
}

function BulletList({ items, color }: { items: string[]; color: string }) {
  return (
    <View style={styles.bulletList}>
      {items.map((item, i) => (
        <Text key={i} style={[styles.bulletItem, { color }]}>
          • {item}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 20 },
  pageTitle: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  lastUpdated: { fontSize: 13, marginBottom: 10 },
  intro: { fontSize: 16, lineHeight: 22 },
  card: { padding: 18, gap: 10 },
  cardTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  body: { fontSize: 14, lineHeight: 20 },
  categoryBlock: { gap: 4 },
  categoryDivider: { borderTopWidth: 1, paddingTop: 12, marginTop: 4 },
  categoryName: { fontSize: 15, fontWeight: "700" },
  categoryBody: { fontSize: 14, lineHeight: 20 },
  categoryBasis: { fontSize: 13, lineHeight: 19, fontStyle: "italic" },
  categoryBasisLabel: { fontWeight: "700", fontStyle: "normal" },
  bulletList: { gap: 6 },
  bulletItem: { fontSize: 14, lineHeight: 20 },
  emailRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline" },
  supportRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  supportText: { fontSize: 14 },
  supportLink: { fontWeight: "700", textDecorationLine: "underline" },
});
