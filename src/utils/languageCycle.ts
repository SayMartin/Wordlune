// Shared by WebTopNav.tsx and HeaderRight.tsx, both of which expose language
// switching as a single tappable flag icon that cycles through every
// supported language rather than a dropdown menu — simplest UX for a small,
// fixed set of languages; revisit as a proper picker if a 4th is ever added.
export const LANGUAGE_CYCLE = ["en", "sv", "fr"] as const;

export function flagFor(lang: string): string {
  const code = lang.split("-")[0];
  if (code === "sv") return "🇸🇪";
  if (code === "fr") return "🇫🇷";
  if (code === "en") return "🇬🇧";
  return "🌐";
}

export function nextLanguage(lang: string): string {
  const code = lang.split("-")[0];
  const idx = LANGUAGE_CYCLE.indexOf(code as (typeof LANGUAGE_CYCLE)[number]);
  return LANGUAGE_CYCLE[(idx + 1) % LANGUAGE_CYCLE.length] ?? "en";
}
