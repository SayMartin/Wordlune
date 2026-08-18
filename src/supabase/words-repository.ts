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

export async function listHydrocarbonFiveLetterWords(
  lang = "en",
): Promise<string[]> {
  try {
    const col = wordColumn(lang);

    // 1. Find subcategory id for "%hydrocarbons%"
    const { data: subData, error: subError } = await supabase
      .from("subcategories")
      .select("id")
      .ilike("name_en", "%hydrocarbons%")
      .limit(1);

    if (subError) throw subError;
    if (!subData || subData.length === 0) return [];

    const subId = subData[0].id;

    // 2. Get word IDs
    const wordIds = await listWordIdsForSubcategories([subId]);
    if (wordIds.length === 0) return [];

    // 3. Get words (filtered by 5 letters)
    // We reuse listWordsByIds but filtering logic is client side or we can improve listWordsByIds
    // Actually listWordsByIds returns strings.
    // Fetch all words for the category and filter for length 5
    const allWords = await listWordsByIds(wordIds, lang, 10000); // High limit to get all

    // 4. Filter 5 letters
    const fiveLetter = allWords.filter((w) => w && w.length === 5);

    // Dedupe
    return Array.from(new Set(fiveLetter.map((w) => w.toUpperCase())));
  } catch (err) {
    console.error("listHydrocarbonFiveLetterWords error", err);
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
    } catch (_) {
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
      } catch (_) {
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
  const col = `name_${lang}`;
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
  const col = `name_${lang}`;
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

// --- board realtime helpers ---
export async function getRecentBoardEvents(boardId: string, limit = 50) {
  try {
    const { data, error } = await supabase
      .from("board_events")
      .select("*")
      .eq("board_id", boardId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  } catch (err) {
    console.error("getRecentBoardEvents error", err);
    return [];
  }
}

export async function getBoardState(boardId: string) {
  try {
    const { data, error } = await supabase
      .from("board_state")
      .select("*")
      .eq("board_id", boardId)
      .single();
    if (error) throw error;
    return data ?? null;
  } catch (err) {
    console.error("getBoardState error", err);
    return null;
  }
}

export function createBoardChannel(boardId: string) {
  const topic = `board:${boardId}:events`;
  return supabase.channel(topic, { config: { private: true } });
}

export async function addBoardEvent(
  boardId: string,
  eventType: string,
  payload: any = {},
) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user ?? null;
    const insert = {
      board_id: boardId,
      user_id: user?.id ?? null,
      event_type: eventType,
      payload,
    } as any;
    const { data, error } = await supabase.from("board_events").insert(insert);
    if (error) throw error;
    return data;
  } catch (err) {
    console.error("addBoardEvent error", err);
    return null;
  }
}

/**
 * Specifically for Duel Mode:
 * Finds the "Hydrocarbons" subcategory, fetches all linked words,
 * filters for 5-letter words in the given language, and returns one at random.
 */
export async function getFiveLetterHydrocarbon(
  lang: string = "en",
): Promise<string | null> {
  try {
    // 1. Find the CATEGORY "Hydrocarbons" (it is a main category, not subcategory)
    const { data: cats, error: catError } = await supabase
      .from("categories")
      .select("id")
      .ilike("name_en", "%hydrocarbons%")
      .limit(1);

    if (catError || !cats || cats.length === 0) {
      console.warn("Category 'Hydrocarbons' not found.");
      return null;
    }
    const catId = cats[0].id;

    // 2. Find all subcategories for this category
    const { data: subcats, error: subError } = await supabase
      .from("subcategories")
      .select("id")
      .eq("category_id", catId);

    if (subError || !subcats || subcats.length === 0) {
      console.warn("No subcategories found for Hydrocarbons.");
      return null;
    }

    // 3. Get all word IDs for these subcategories
    const subcatIds = subcats.map((s: any) => s.id);
    const wordIds = await listWordIdsForSubcategories(subcatIds);
    if (wordIds.length === 0) return null;

    // 4. Fetch the actual words (in the requested language)
    // We filter by length=5
    const words = await listWordsByIds(wordIds, lang, 5000);

    // 5. Filter for exactly 5 letters
    const candidates = words.filter((w) => w && w.length === 5);

    if (candidates.length === 0) return null;

    // 6. Pick random
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  } catch (err) {
    console.error("getFiveLetterHydrocarbon error", err);
    return null;
  }
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

export async function getAllHydrocarbonSubcategories(): Promise<
  { id: string; name_en: string; name_sv: string; name_fr: string }[]
> {
  try {
    const { data: cats, error: catError } = await supabase
      .from("categories")
      .select("id")
      .ilike("name_en", "%hydrocarbons%")
      .limit(1);

    if (catError || !cats || cats.length === 0) return [];

    const { data, error } = await supabase
      .from("subcategories")
      .select("id, name_en, name_sv, name_fr")
      .eq("category_id", cats[0].id)
      .order("name_en");

    if (error) {
      console.error("Error fetching hydrocarbon subcategories:", error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("getAllHydrocarbonSubcategories exception:", err);
    return [];
  }
}
