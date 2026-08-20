/**
 * Bump whenever the substance of the privacy policy changes — not for typo or
 * translation fixes. Stamped into player_profiles.metadata.privacy_policy at
 * signup so it's possible to tell which version a given player accepted.
 *
 * The policy screen renders this same value as its "last updated" date, so the
 * two can never drift apart.
 */
export const PRIVACY_POLICY_VERSION = "2026-08-20";

/**
 * Built by concatenation rather than a literal string, so the address doesn't
 * appear verbatim in the page source for simple scrapers to harvest.
 */
export const SUPPORT_EMAIL = ["support", "appfinningar.se"].join("@");

/**
 * The data controller, as named in the privacy policy. A sole trader rather
 * than a registered company, so there is deliberately no org.nr here — for an
 * enskild firma that number is the owner's personnummer.
 */
export const CONTROLLER_NAME = "appfinningar.se";

/** Minimum age for a self-created account (dataskyddslagen 2 kap. 4 §). */
export const MINIMUM_AGE = 13;
