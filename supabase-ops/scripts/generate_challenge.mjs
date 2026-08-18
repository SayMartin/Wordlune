import fs from "fs";
import { createClient } from "@supabase/supabase-js";

// Load environment variables locally
function loadEnv(path = ".env") {
  try {
    const src = fs.readFileSync(path, "utf8");
    const lines = src.split(/\r?\n/);
    const out = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const val = trimmed.slice(eq + 1);
      out[key] = val.replace(/^\s*"|"\s*$/g, "");
    }
    return out;
  } catch (e) {
    return {};
  }
}

const env = loadEnv(".env");
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env or process.env",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const MAX_WORD_LENGTH = 12;

// The requested sets
const CHALLENGE_SETS = [
  ["car-brands", "capital-cities-africa", "cities-sweden"],
  ["at-sea", "countries", "capital-cities-europe"],
  ["bicycle-brands", "countries-africa", "capital-cities"],
  ["motorcycle-brands", "countries-europe", "villages-öland"],
];

function normalizeToSlug(s) {
  if (!s) return "";
  return s.toLowerCase().replace(/[\s_:]+/g, "-");
}

async function generateAllConfiguredChallenges() {
  console.log("🚀 Starting generation of configured challenges...");

  // 1. Fetch all subcategories (slug might not exist, so use name_en)
  const { data: allSubcats, error: catError } = await supabase
    .from("subcategories")
    .select("id, name_native, name_en, name_sv, name_fr");

  if (catError || !allSubcats) {
    console.error("Failed to fetch subcategories:", catError);
    return;
  }

  // Create lookup map: normalized-slug -> id
  const slugMap = new Map();
  const idToNameMap = new Map();

  allSubcats.forEach((sc) => {
    // Store names for description generation
    idToNameMap.set(sc.id, {
      en: sc.name_en || sc.name_native,
      sv: sc.name_sv || sc.name_native || sc.name_en,
      fr: sc.name_fr || sc.name_native || sc.name_en,
    });

    if (sc.name_native) {
      const slug = normalizeToSlug(sc.name_native);
      slugMap.set(slug, sc.id);
      // Also map exact name just in case
      slugMap.set(sc.name_native, sc.id);
    }
    // Also map EN name if native fails or is different
    if (sc.name_en) {
      const slugEn = normalizeToSlug(sc.name_en);
      slugMap.set(slugEn, sc.id);
      slugMap.set(sc.name_en, sc.id);
    }
  });

  console.log(`ℹ️ Loaded ${slugMap.size} subcategory mappings.`);

  let setIndex = 1;
  for (const slugSet of CHALLENGE_SETS) {
    console.log(
      `\n--- Processing Set #${setIndex}: [${slugSet.join(", ")}] ---`,
    );
    await createChallengeForSlugs(slugSet, slugMap, idToNameMap, setIndex);
    setIndex++;
  }

  // Iterate over each CHALLENGE_SET again to create a 5x5 version for each
  setIndex = 1;
  const fiveLetterLimit = 4; // Or use CHALLENGE_SETS.length if you want all
  for (const slugSet of CHALLENGE_SETS) {
    console.log(
      `\n--- Generating 'Easy 5x5' Challenge #${setIndex} for set: [${slugSet.join(", ")}] ---`,
    );

    // Resolve IDs just for this set
    const currentSetIds = new Set();
    slugSet.forEach((slug) => {
      const rawId = slugMap.get(slug);
      const norm = normalizeToSlug(slug);
      const normId = slugMap.get(norm);
      if (rawId) currentSetIds.add(rawId);
      if (normId) currentSetIds.add(normId);
    });

    if (currentSetIds.size > 0) {
      await generateFiveLetterChallenge(
        Array.from(currentSetIds),
        idToNameMap,
        setIndex,
      );
    } else {
      console.warn("Skipping 5x5 for set (no valid IDs found):", slugSet);
    }
    setIndex++;
  }

  console.log("\n✅ Finished processing all sets.");
  process.exit(0);
}

async function generateFiveLetterChallenge(
  limitToSubcatIds = [],
  idToNameMap,
  index = 1,
) {
  if (!limitToSubcatIds || limitToSubcatIds.length === 0) {
    console.warn(
      "⚠️ limitToSubcatIds is empty for 5x5 challenge. Skipping to avoid selecting random words.",
    );
    return;
  }

  // 1. Fetch a broad sample of words that are actually used in subcategories (curated)
  let query = supabase
    .from("words_subcategories")
    .select("word_id")
    .in("subcategory_id", limitToSubcatIds);

  const { data: links, error: linkError } = await query;

  if (linkError) {
    console.error("Failed to fetch word links for 5x5:", linkError);
    return;
  }

  const allWordIds = [...new Set(links.map((l) => l.word_id))];

  // Shuffle and limit to 200 IDs to avoid "Bad Request" query too long
  const sampleIds = allWordIds.sort(() => 0.5 - Math.random()).slice(0, 200);

  // 2. Fetch word details to check lengths
  const { data: words, error: wordsError } = await supabase
    .from("words")
    .select("id, word_en, word_sv, word_fr")
    .in("id", sampleIds);

  if (wordsError) {
    console.error("Failed to fetch words for 5x5:", wordsError);
    return;
  }

  // 3. Filter for exactly 5 letters in ALL THREE languages
  const candidates = words.filter((w) => {
    if (!w.word_en || !w.word_sv || !w.word_fr) return false;
    return (
      w.word_en.trim().length === 5 &&
      w.word_sv.trim().length === 5 &&
      w.word_fr.trim().length === 5
    );
  });

  if (candidates.length < 5) {
    console.warn(
      `⚠️ Not enough 5-letter words found in sample (found ${candidates.length}). Skipping Easy 5x5.`,
    );
    return;
  }

  // 4. Pick 5 random
  const shuffled = candidates.sort(() => 0.5 - Math.random());
  const selectedWords = shuffled.slice(0, 5);
  const selectedWordIds = selectedWords.map((w) => w.id);

  console.log(
    `✅ Selected 5 words for Easy 5x5: ${selectedWords
      .map((w) => w.word_en)
      .join(", ")}`,
  );

  const dateStr = new Date().toISOString().split("T")[0];
  const name = `Challenge 5x5 ${dateStr} #${index}`;

  // Description uses the LIMITED pool of subcats (the input set), not the "related subcats" found on the words
  // This matches the behavior of the main challenge generation which lists the *target* categories
  const targetSubcatIds = limitToSubcatIds;

  const namesEn = targetSubcatIds
    .map((id) => idToNameMap.get(id)?.en)
    .filter(Boolean);
  const namesSv = targetSubcatIds
    .map((id) => idToNameMap.get(id)?.sv)
    .filter(Boolean);

  const description = {
    en: ["5 letters", ...namesEn],
    sv: ["5 bokstäver", ...namesSv],
  };

  const { error: insertError } = await supabase
    .from("competitive_challenges")
    .insert([
      {
        name: name,
        description: description,
        difficulty: "Easy",
        subcategory_ids: targetSubcatIds,
        word_ids: selectedWordIds,
        start_date: new Date().toISOString(),
        is_five_chars: true,
      },
    ]);

  if (insertError) {
    console.error("❌ Error inserting Easy 5x5 challenge:", insertError);
  } else {
    console.log("✅ Created Easy 5x5 Challenge successfully.");
  }
}

async function createChallengeForSlugs(
  slugList,
  slugMap,
  idToNameMap,
  challengeNumber,
) {
  // Resolve IDs
  const subcatIds = [];
  const validSlugs = [];

  for (const s of slugList) {
    const rawId = slugMap.get(s);
    // Try normalized match
    const norm = normalizeToSlug(s);
    const normId = slugMap.get(norm);

    const finalId = rawId || normId;

    if (finalId) {
      subcatIds.push(finalId);
      validSlugs.push(s);
    } else {
      console.warn(
        `⚠️ Warning: Subcategory '${s}' (normalized: '${norm}') not found in database.`,
      );
    }
  }

  if (subcatIds.length === 0) {
    console.error("❌ No valid subcategories found for this set. Skipping.");
    return;
  }

  // Fetch words linked to these subcategories
  const { data: links, error: linkError } = await supabase
    .from("words_subcategories")
    .select("word_id")
    .in("subcategory_id", subcatIds);

  if (linkError) {
    console.error("Failed to fetch word links for set:", linkError);
    return;
  }

  const allWordIds = links.map((l) => l.word_id);
  const uniqueWordIds = [...new Set(allWordIds)];

  if (uniqueWordIds.length < 5) {
    console.error(
      `❌ Not enough words found. Found: ${uniqueWordIds.length}. Need at least 5.`,
    );
    return;
  }

  // Fetch actual words to filter by length.
  // IMPORTANT: Must fetch EN, SV, and FR to ensure the challenge is playable in all three.
  const { data: words, error: wordsError } = await supabase
    .from("words")
    .select("id, word_en, word_sv, word_fr")
    .in("id", uniqueWordIds);

  if (wordsError) {
    console.error("Failed to fetch word details:", wordsError);
    return;
  }

  // Filter max length 12
  const candidates = words.filter((w) => {
    // 1. Must exist in all three languages
    if (!w.word_en || !w.word_sv || !w.word_fr) return false;

    // 2. All three must strictly respect the length limit
    const enLen = w.word_en.trim().length;
    const svLen = w.word_sv.trim().length;
    const frLen = w.word_fr.trim().length;

    return (
      enLen > 0 &&
      enLen <= MAX_WORD_LENGTH &&
      svLen > 0 &&
      svLen <= MAX_WORD_LENGTH &&
      frLen > 0 &&
      frLen <= MAX_WORD_LENGTH
    );
  });

  if (candidates.length < 5) {
    console.error(
      `❌ Not enough words after filtering length <= ${MAX_WORD_LENGTH} in all three languages. Found: ${candidates.length}.`,
    );
    return;
  }

  // Pick 5 at random
  const shuffled = candidates.sort(() => 0.5 - Math.random());
  const selectedWords = shuffled.slice(0, 5);
  const selectedWordIds = selectedWords.map((w) => w.id);

  console.log(
    `✅ Selected ${selectedWords.length} words: ${selectedWords
      .map((w) => w.word_en)
      .join(", ")}`,
  );

  // Calculate difficulty (avg length of English words for now, could average both)
  const avgLen =
    selectedWords.reduce((acc, w) => acc + w.word_en.length, 0) /
    selectedWords.length;
  const difficulty = avgLen > 8 ? "Hard" : avgLen > 5 ? "Medium" : "Easy";

  // Name: "Challenge [startdate] [number]"
  // Date format: YYYY-MM-DD
  const dateStr = new Date().toISOString().split("T")[0];
  const name = `Challenge ${dateStr} #${challengeNumber}`;

  // Description: JSON object with both languages (arrays of strings)
  const namesEn = subcatIds
    .map((id) => idToNameMap.get(id)?.en)
    .filter(Boolean);
  const namesSv = subcatIds
    .map((id) => idToNameMap.get(id)?.sv)
    .filter(Boolean);

  const description = {
    en: namesEn,
    sv: namesSv,
  };

  // Insert into DB
  const { data: insertData, error: insertError } = await supabase
    .from("competitive_challenges")
    .insert([
      {
        name: name,
        description: description, // Supabase client handles object -> JSONB
        difficulty: difficulty,
        subcategory_ids: subcatIds,
        word_ids: selectedWordIds,
        start_date: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (insertError) {
    console.error("❌ Error inserting challenge:", insertError);
  } else {
    console.log(
      `🎉 Created challenge: "${insertData.name}" (ID: ${insertData.id})`,
    );
  }
}

generateAllConfiguredChallenges();
