import { supabase } from "../supabaseClient";
import { wordColumn, nameColumn } from "./langColumns";

const DEFAULT_LIMIT = 10000; // Increased to ensure we get full categories/lists

const CACHE_5_LETTER: Record<string, string[]> = {};

export async function listFiveLetterWords(lang = "en"): Promise<string[]> {
  try {
    if (CACHE_5_LETTER[lang]) return CACHE_5_LETTER[lang];

    const col = wordColumn(lang);

    // Fetch all words that are 5 letters long
    // Using ilike with 5 underscores matches any 5-char string
    const { data, error } = await supabase
      .from("words")
      .select(col)
      .ilike(col, "_____")
      .limit(10000); // Safety limit, though we hope there aren't >10k 5-letter words?
    // Standard Wordle dict is ~2.5k (solutions) + ~10k (guesses).
    // We might need to split pagination if it's huge.

    if (error) throw error;

    // Deduplicate and normalize
    const words = Array.from(
      new Set(
        (data ?? [])
          .map((w: any) => safeToUpper(w[col]))
          .filter((w: any) => !!w),
      ),
    ) as string[];

    CACHE_5_LETTER[lang] = words;
    return words;
  } catch (err) {
    console.error("listFiveLetterWords error", err);
    return [];
  }
}

function safeToUpper(s: any) {
  if (!s) return "";
  return String(s).toUpperCase();
}

function pickLocalizedName(row: any, lang: string, variants: string[]) {
  if (!row) return "";

  // Build a lowercase-key -> original-key map so we can match columns
  // regardless of how the DB capitalizes them.
  const lcMap: Record<string, string> = {};
  for (const k of Object.keys(row)) lcMap[k.toLowerCase()] = k;

  const displayCandidates = [
    `name_${lang}`,
    `${variants[0]}_${lang}`,
    `name_en`,
    `name_sv`,
    `${variants[0]}_en`,
    `${variants[0]}_sv`,
    `name`,
    `title`,
  ];

  for (const c of displayCandidates) {
    const orig = lcMap[c.toLowerCase()];
    if (orig && row[orig]) {
      const val = row[orig];
      if (typeof val === "string" && val === val.toLowerCase()) {
        return val
          .split(/[_\s-]+/)
          .map((w: string) =>
            w.length > 0 ? w[0].toUpperCase() + w.slice(1) : "",
          )
          .join(" ");
      }
      return val;
    }
  }

  for (const v of variants) {
    const orig = lcMap[v.toLowerCase()];
    if (orig && row[orig]) {
      const val = row[orig];
      if (typeof val === "string" && val === val.toLowerCase()) {
        return val
          .split(/[_\s-]+/)
          .map((w: string) =>
            w.length > 0 ? w[0].toUpperCase() + w.slice(1) : "",
          )
          .join(" ");
      }
      return val;
    }
  }

  // Last-resort: normalized/canonical columns (these tend to be lowercase
  // and may need title-casing for display)
  const canonicalCandidates = [
    `canonical_normalized_${lang}`,
    `canonical_normalized`,
    `${variants[0]}_canonical_normalized_${lang}`,
    `${variants[0]}_canonical_normalized`,
  ];
  for (const c of canonicalCandidates) {
    const orig = lcMap[c.toLowerCase()];
    if (orig && row[orig]) {
      const val = row[orig];
      if (typeof val === "string") {
        // Turn `mountain_ranges` or `mountain ranges` into `Mountain Ranges`
        return val
          .split(/[_\s-]+/)
          .map((w: string) =>
            w.length > 0 ? w[0].toUpperCase() + w.slice(1) : "",
          )
          .join(" ");
      }
      return val;
    }
  }

  return "";
}

export async function listAllWords(
  lang = "en",
  limit = DEFAULT_LIMIT,
): Promise<string[]> {
  const col = wordColumn(lang);
  try {
    // prefer language-specific column, fall back to common ones
    const trySelect = async (selectCol: string) => {
      const { data, error } = await supabase
        .from("words")
        .select(`id, ${selectCol}`)
        .limit(limit);
      if (error) throw error;
      return (data ?? [])
        .map((w: any) => safeToUpper(w[selectCol] || w.word || w.word_sv || ""))
        .filter(Boolean);
    };
    try {
      return await trySelect(col);
    } catch {
      return await trySelect("word");
    }
  } catch (err) {
    console.error("listAllWords error", err);
    return [];
  }
}

export async function listWordIdsForSubcategories(
  subcatIds: string[],
): Promise<string[]> {
  try {
    if (!subcatIds || subcatIds.length === 0) return [];

    let allData: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("words_subcategories")
        .select("word_id, subcategory_id")
        .in("subcategory_id", subcatIds)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      const rows = data ?? [];
      allData = allData.concat(rows);
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allData.map((r: any) => r.word_id).filter(Boolean);
  } catch (err) {
    console.error("listWordIdsForSubcategories error", err);
    return [];
  }
}

export async function listWordsByIds(
  ids: string[],
  lang = "en",
  limit = DEFAULT_LIMIT,
): Promise<string[]> {
  if (!ids || ids.length === 0) return [];
  const chunk = (arr: any[], size: number) => {
    const out: any[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };
  const col = wordColumn(lang);
  try {
    const idChunks = chunk(ids, 200);
    let wordsData: any[] = [];
    for (const c of idChunks) {
      try {
        const { data, error } = await supabase
          .from("words")
          .select(`id, ${col}`)
          .in("id", c)
          .limit(limit);
        if (error) throw error;
        wordsData = wordsData.concat(data ?? []);
      } catch {
        const { data, error } = await supabase
          .from("words")
          .select(`id, word`)
          .in("id", c)
          .limit(limit);
        if (error) throw error;
        wordsData = wordsData.concat(data ?? []);
      }
    }
    return (wordsData ?? [])
      .map((w: any) => safeToUpper(w[col] || w.word || w.word_sv || ""))
      .filter(Boolean);
  } catch (err) {
    console.error("listWordsByIds error", err);
    return [];
  }
}

// --- categories / subcategories helpers ---
export async function listCategories(lang = "en") {
  try {
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .limit(1000);
    if (error) throw error;
    const cats = data ?? [];
    const rows = cats.map((r: any) => ({
      id: r.id,
      name: pickLocalizedName(r, lang, ["name"]),
      slug: r.slug,
    }));
    rows.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
    return rows;
  } catch (err) {
    console.error("listCategories error", err);
    return [];
  }
}

export async function listSubcategories(lang = "en", categoryIds?: string[]) {
  try {
    let q = supabase.from("subcategories").select("*");
    if (categoryIds && categoryIds.length > 0)
      q = q.in("category_id", categoryIds);
    const { data, error } = await q;
    if (error) throw error;
    const subs = data ?? [];
    const rows = subs.map((r: any) => ({
      id: r.id,
      name: pickLocalizedName(r, lang, ["name"]),
      category_id: r.category_id,
    }));
    rows.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || ""));
    return rows;
  } catch (err) {
    console.error("listSubcategories error", err);
    return [];
  }
}

export async function listWordsSubcategories(subcatIds: string[]) {
  try {
    // validated input below
    if (!subcatIds) return [];
    const idsArr = Array.isArray(subcatIds) ? subcatIds : [subcatIds];
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const filtered = idsArr
      .map((s) => String(s).trim())
      .filter(Boolean)
      .filter((id) => uuidRe.test(id));
    if (filtered.length === 0) {
      console.warn("listWordsSubcategories: no valid UUID subcategory ids", {
        subcatIds,
      });
      return [];
    }

    let allData: any[] = [];
    let from = 0;
    const PAGE_SIZE = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("words_subcategories")
        .select("word_id, subcategory_id")
        .in("subcategory_id", filtered)
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;
      const rows = data ?? [];
      allData = allData.concat(rows);
      if (rows.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
    return allData;
  } catch (err) {
    console.error("listWordsSubcategories error", err);
    return [];
  }
}

const CACHE_ANSWERS_5: Record<string, string[]> = {};

/**
 * A random five-letter word to be guessed, in the given language.
 *
 * Reads `answer_eligible_words`, not `words`: proper-noun lists like "Villages
 * on Öland" are excluded from being the answer while remaining perfectly valid
 * *guesses* (listFiveLetterWords, which the duel pool uses, still includes
 * them) and remaining playable in practice mode, where the player chooses the
 * category deliberately. The rule lives in Postgres — see
 * 20260825_answer_eligible_subcategories.sql — so the client can't drift from
 * it, the same reasoning the leaderboard views follow.
 *
 * Duel used to draw its secret from the Hydrocarbons category alone. Drawing
 * from the whole dictionary gives duels the variety the practice screen has
 * and, more importantly, lets guess validation be on without rejecting most of
 * the language.
 */
export async function getRandomFiveLetterWord(
  lang: string = "en",
): Promise<string | null> {
  const words = await listAnswerEligibleFiveLetterWords(lang);
  if (words.length === 0) return null;
  return words[Math.floor(Math.random() * words.length)];
}

async function listAnswerEligibleFiveLetterWords(lang: string): Promise<string[]> {
  if (CACHE_ANSWERS_5[lang]) return CACHE_ANSWERS_5[lang];

  const col = wordColumn(lang);
  const { data, error } = await supabase
    .from("answer_eligible_words")
    .select(col)
    .ilike(col, "_____")
    .limit(DEFAULT_LIMIT);

  if (error) {
    // Deliberately no fallback to listFiveLetterWords. There was one while
    // 20260825_answer_eligible_subcategories.sql was still unapplied, to cover
    // a client newer than the database it talks to; the migration was applied
    // to production on 2026-08-25 (verified against the data, not against a
    // migration log — there isn't one), so that window is closed.
    //
    // Falling back now would silently reinstate exactly what the view exists to
    // prevent: an unwinnable duel on a Swedish village name, reported by nobody
    // because it looks like bad luck rather than a bug. An empty pool surfaces
    // as a visible failure instead, which is the outcome worth having.
    console.error("answer_eligible_words unavailable", error);
    return [];
  }

  const words = Array.from(
    new Set((data ?? []).map((w: any) => safeToUpper(w[col])).filter(Boolean)),
  ) as string[];

  CACHE_ANSWERS_5[lang] = words;
  return words;
}


export interface WordWithCategories {
  word: string;
  subcategories: { id: string; name: string }[];
}

export async function getExtensionsForWord(
  word: string,
  lang: string = "en",
): Promise<WordWithCategories | null> {
  try {
    const col = wordColumn(lang);
    const subNameCol = nameColumn(lang);

    // 1. Find word id
    // We treat "-" as word boundary in ILIKE sometimes, but here we want exact match
    const { data: wData, error: wError } = await supabase
      .from("words")
      .select("id")
      .ilike(col, word)
      .limit(1);

    if (wError || !wData || wData.length === 0) {
      // Fallback check against 'word_native' column if not found
      const { data: fallback, error: fError } = await supabase
        .from("words")
        .select("id")
        .ilike("word_native", word)
        .limit(1);

      if (fError || !fallback || fallback.length === 0) {
        console.warn(
          `[getExtensionsForWord] word '${word}' not found in 'word_native' column either.`,
          fError,
        );
        return null;
      }
      const wordId = fallback[0].id;

      // proceed with wordId
      return fetchSubcatsForWordId(wordId, word, subNameCol);
    }
    const wordId = wData[0].id;
    return fetchSubcatsForWordId(wordId, word, subNameCol);
  } catch (err) {
    console.error("getExtensionsForWord error", err);
    return null;
  }
}

async function fetchSubcatsForWordId(
  wordId: string,
  word: string,
  subNameCol: string,
) {
  // 2. Find links -> subcategories IDs first (avoid join ambiguity)
  const { data: links, error: lError } = await supabase
    .from("words_subcategories")
    .select("subcategory_id")
    .eq("word_id", wordId);

  if (lError) {
    console.error("[fetchSubcatsForWordId] Error fetching links:", lError);
    return null;
  }

  if (!links || links.length === 0) {
    return { word, subcategories: [] };
  }

  const subIds = links.map((l: any) => l.subcategory_id);

  // 3. Fetch actual subcategory details
  const { data: subDetails, error: sError } = await supabase
    .from("subcategories")
    .select(`id, ${subNameCol}, name_en`)
    .in("id", subIds);

  if (sError) {
    console.error("[fetchSubcatsForWordId] Error fetching subdetails:", sError);
    return null;
  }

  const subs = (subDetails || []).map((s: any) => ({
    id: s.id,
    name: s[subNameCol] || s.name_en || "???",
  }));

  return {
    word: word,
    subcategories: subs,
  };
}

// words: id, word_en, word_sv
// words_categories: word_id, category_id
// words_subcategories: Word_id, subcategory_id

