// Shared by words-repository.ts and players-repository.ts: both query
// per-language columns on words/categories/subcategories (word_en/word_sv/
// word_fr, name_en/name_sv/name_fr). Centralizing this also fixes a latent
// bug where some call sites used "word_se" instead of "word_sv" — the
// actual column (see supabase-ops/migrations/001_add_localized_columns.sql)
// has always been word_sv.
const SUPPORTED_LANGS = ["en", "sv", "fr"] as const;

function resolveCode(lang: string): (typeof SUPPORTED_LANGS)[number] {
  const code = lang.split("-")[0];
  return (SUPPORTED_LANGS as readonly string[]).includes(code)
    ? (code as (typeof SUPPORTED_LANGS)[number])
    : "en";
}

export function wordColumn(lang: string): string {
  return `word_${resolveCode(lang)}`;
}

export function nameColumn(lang: string): string {
  return `name_${resolveCode(lang)}`;
}
