#!/usr/bin/env node
/**
 * Generate the competitive challenge schedule.
 *
 * Run AFTER 20260826_challenge_rotation_reset.sql, which wipes the old set and
 * gives challenges a start_date/end_date window.
 *
 *   node supabase-ops/scripts/generate_challenge.mjs --dry-run
 *   node supabase-ops/scripts/generate_challenge.mjs
 *
 * Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from supabase-ops/.env or the
 * environment. Run it from the supabase-ops directory, or point --env at the
 * file. The service-role key is required: competitive_challenges now hides
 * unstarted rows from anon and authenticated (that is the entire point), so a
 * lesser key can neither insert the schedule nor read back what it inserted.
 *
 * WHAT CHANGED FROM THE PREVIOUS VERSION, and why:
 *
 *  * It used to hardcode four subcategory slug sets, two of which ("at-sea",
 *    "bicycle-brands") were retired in 20260825 — and when a slug did not
 *    resolve it printed a warning and carried on with a smaller set. That is
 *    how challenges ended up advertising categories that no longer exist. Now
 *    every named subcategory must resolve, must be answer-eligible, and must
 *    still hold enough words; anything short aborts the whole run before a
 *    single row is written.
 *
 *  * It wrote a frozen `description` snapshot of the category names, in en and
 *    sv only — so French players read English category names. Names are now
 *    resolved by challenge_menu_stats at read time, in all three languages, and
 *    description is left NULL on purpose.
 *
 *  * Difficulty was derived from the average length of the English word, which
 *    says nothing about how hard a word is to guess. It is now set per theme by
 *    hand.
 *
 *  * Words are drawn without replacement across the entire batch, so no word
 *    appears in two challenges.
 *
 *  * Every word is checked against the on-screen keyboard before it is used.
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

/** How many weekly challenges to lay down (26 ≈ six months). */
const WEEKS = 26;

/**
 * A 5x5 challenge every Nth week.
 *
 * Not weekly, and the constraint is real rather than editorial: a 5x5 word must
 * be exactly five letters in ALL THREE languages, and only 75 answer-eligible
 * words qualify (brand lists excluded, see THEMES). 26 weekly 5x5 challenges
 * would need 130 of them. At every third week the batch needs 45, which leaves
 * the pool room to produce a different set next time. checkHeadroom() enforces
 * this rather than trusting the arithmetic in this comment.
 */
const FIVE_EVERY_N_WEEKS = 3;

/**
 * Challenge names, kept free of any hint about their content.
 *
 * Must stay in step with 20260829_neutral_challenge_names.sql, which renames
 * the batch already in the database to exactly these forms.
 */
const WEEKLY_NAME = "Weekly Challenge";
const FIVE_NAME = "5x5 Challenge";

/** Words per challenge. */
const WORDS_PER_CHALLENGE = 5;

/** Longest word a challenge may use, in every language. Mirrors ABSOLUTE_MAX_LETTERS in GameScreen.tsx. */
const MAX_WORD_LENGTH = 12;

/**
 * Shortest word worth guessing. Four, not three: with six guesses a three-letter
 * board is solved by exhaustion rather than deduction, and a curated challenge
 * is the one place we get to choose. The pool has the headroom for it.
 */
const MIN_WORD_LENGTH = 4;

/**
 * Require the candidate pool to be this many times the batch's needs before
 * generating. Below it, generating would consume nearly everything and the next
 * batch would have to repeat words.
 */
const REQUIRED_HEADROOM = 1.4;

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/**
 * Themes, cycled in order across the weeks.
 *
 * Subcategories are named by their `name_en`, which is what the database
 * actually stores — the old version guessed at slugs ("villages-öland",
 * "capital-cities-africa") and normalised them into a lookup map, which is why
 * a rename or a deletion produced a silent warning instead of an error.
 *
 * BRAND LISTS ARE DELIBERATELY ABSENT. "Car Brands" and "Motorcycle Brands" are
 * answer-eligible and stay playable in practice mode, but they are exactly the
 * content 20260825_remove_bicycle_brands_and_at_sea.sql retired Bicycle Brands
 * for: proper nouns nobody can reason toward, spelled identically in all three
 * languages, so the category hint tells a player nothing and the language they
 * are playing in tells them nothing either. A curated challenge is the one
 * place that choice is fully ours to make.
 *
 * Difficulty is set here rather than computed. "Hard" means the answer is a
 * proper noun the player has to recall rather than reason out; "Easy" means
 * everyday nouns with real translations in all three languages.
 */
const THEMES = [
  { key: "nature", label: "Nature", subcategories: ["Animals", "Plants"], difficulty: "Easy" },
  { key: "world", label: "The World", subcategories: ["Countries", "Capital cities"], difficulty: "Hard" },
  { key: "food", label: "Food", subcategories: ["Fruits", "Vegetables", "Groceries"], difficulty: "Easy" },
  { key: "africa", label: "Africa", subcategories: ["Countries in Africa", "Capitals of Africa"], difficulty: "Hard" },
  { key: "home", label: "Everyday", subcategories: ["Kitchen", "Body"], difficulty: "Easy" },
  { key: "europe", label: "Europe", subcategories: ["Countries in Europe", "Capitals of Europe"], difficulty: "Medium" },
  { key: "living", label: "Living Things", subcategories: ["Animals", "Plants", "Fruits", "Vegetables"], difficulty: "Easy" },
  { key: "geography", label: "Geography", subcategories: ["Countries", "Capital cities"], difficulty: "Hard" },
];

/** The theme a 5x5 challenge draws from: everything, since the pool is small. */
const FIVE_THEME = {
  key: "five",
  label: "Five by Five",
  subcategories: THEMES.flatMap((t) => t.subcategories),
  difficulty: "Medium",
};

// ---------------------------------------------------------------------------
// Typeability
// ---------------------------------------------------------------------------

/**
 * The characters each language's on-screen keyboard can actually produce —
 * copied from Keyboard.tsx's LAYOUTS, plus space and hyphen.
 *
 * Audited against LAYOUTS, NOT against GameScreen.tsx's LETTER_PATTERNS. The
 * physical-keyboard regex accepts more than the on-screen keyboard offers (Ë,
 * Ï, Ü, Æ, Œ in French), and auditing against it is what let THAÏLANDE, HAÏTI
 * and ISRAËL through as unwinnable rounds — a bug the 20260825 audit missed and
 * 20260825_fix_french_dieresis.sql had to clean up afterwards. A word nobody
 * can type is worth nothing however correctly it is spelled.
 */
const TYPEABLE = {
  en: "QWERTYUIOPASDFGHJKLZXCVBNM -",
  sv: "QWERTYUIOPÅASDFGHJKLÖÄZXCVBNM -",
  fr: "AZERTYUIOPQSDFGHJKLMWXCVBNÄÖÅÉÈÊÀÂÇÎÔÙÛ -",
};

function untypeableChars(word, lang) {
  const allowed = new Set(TYPEABLE[lang].split(""));
  const bad = new Set();
  // Hyphen and dash variants are normalised by useGame's evaluateGuess, but a
  // non-ASCII dash still has no key; treat only the plain hyphen as typeable.
  for (const ch of word.trim().toUpperCase()) {
    if (!allowed.has(ch)) bad.add(ch);
  }
  return [...bad];
}

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

function loadEnv(file) {
  try {
    const out = {};
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      // Tolerate a leading `export`, which a file that is also sourced by a
      // shell will have and which the previous parser turned into part of the
      // key name.
      const key = trimmed.slice(0, eq).trim().replace(/^export\s+/, "");
      out[key] = trimmed
        .slice(eq + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
    return { vars: out, exists: true };
  } catch {
    return { vars: {}, exists: false };
  }
}

/**
 * Accepted spellings, in priority order.
 *
 * There are three of them because the scripts in this directory disagree:
 * this one historically read only VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY,
 * while upload_seeds_to_staging.js accepts SUPABASE_URL and SUPABASE_SERVICE_KEY.
 * Whichever pair happens to be in .env should work rather than producing a
 * "missing credentials" error against a file that plainly has credentials in it.
 */
const URL_KEYS = ["SUPABASE_URL", "VITE_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL"];
const SERVICE_KEYS = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"];

const pick = (names, env) => {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
    if (env[n]) return env[n];
  }
  return undefined;
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE = args.includes("--force");
const envArgIndex = args.indexOf("--env");
const envFile = envArgIndex !== -1 ? args[envArgIndex + 1] : path.resolve(process.cwd(), ".env");
const { vars: env, exists: envExists } = loadEnv(envFile);

const SUPABASE_URL = pick(URL_KEYS, env);
const SUPABASE_SERVICE_KEY = pick(SERVICE_KEYS, env);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  // Report the key NAMES found in the file, never their values — this is the
  // one file in the project that must never have its contents printed, and a
  // bare "missing credentials" against a file that obviously has them is
  // undiagnosable without opening it.
  console.error(`\n✖ Missing Supabase credentials.\n`);
  console.error(`  Looked in the environment and: ${envFile}`);
  console.error(`  That file ${envExists ? "exists" : "does NOT exist"}.`);
  if (envExists) {
    const found = Object.keys(env);
    console.error(`  Names defined in it: ${found.length ? found.join(", ") : "(none parsed)"}`);
  }
  console.error(`\n  Project URL — any one of: ${URL_KEYS.join(", ")}   ${SUPABASE_URL ? "✓ found" : "✗ missing"}`);
  console.error(`  Service role key — any one of: ${SERVICE_KEYS.join(", ")}   ${SUPABASE_SERVICE_KEY ? "✓ found" : "✗ missing"}`);
  console.error(`\n  Either rename the key in .env to one of the above, or pass it inline:`);
  console.error(`    SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/generate_challenge.mjs --dry-run`);
  console.error(`  A different env file: --env path/to/file\n`);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

// ---------------------------------------------------------------------------

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

/** Deterministic shuffle so --dry-run shows what a real run would insert. */
function makeRandom(seed) {
  let h = seed >>> 0;
  return () => {
    h ^= h << 13;
    h >>>= 0;
    h ^= h >> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
}

function shuffle(list, rnd) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Monday of the week containing `date`, at 00:00 UTC. */
function mondayOf(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

const isoDate = (d) => d.toISOString().split("T")[0];

// ---------------------------------------------------------------------------

async function loadSubcategories() {
  const { data, error } = await supabase
    .from("subcategories")
    .select("id, name_en, name_sv, name_fr, is_answer_eligible");
  if (error) fail(`Could not read subcategories: ${error.message}`);

  const byName = new Map();
  for (const s of data) {
    if (s.name_en) byName.set(s.name_en, s);
  }
  return byName;
}

/**
 * Resolve a theme's subcategory names to ids, aborting on anything that does
 * not resolve or is barred from supplying answers.
 */
function resolveTheme(theme, byName) {
  const ids = [];
  for (const name of new Set(theme.subcategories)) {
    const sub = byName.get(name);
    if (!sub) {
      fail(
        `Theme "${theme.label}" names subcategory "${name}", which does not exist in the database.\n` +
          `  Known names: ${[...byName.keys()].sort().join(", ")}\n` +
          `  Fix THEMES in this script rather than letting the run continue — a challenge that ` +
          `silently drops a category is how the previous set ended up advertising retired ones.`,
      );
    }
    if (!sub.is_answer_eligible) {
      fail(
        `Theme "${theme.label}" names subcategory "${name}", which has is_answer_eligible = false.\n` +
          `  Those are proper-noun lists that may be guessed but must never be the answer ` +
          `(20260825_answer_eligible_subcategories.sql). A challenge word IS the answer.`,
      );
    }
    ids.push(sub.id);
  }
  return ids;
}

/**
 * Words linked to any of `subcategoryIds`, plus the reverse map of which
 * subcategories each word belongs to.
 *
 * The reverse map is what lets a 5x5 challenge describe itself. Its word pool
 * is drawn from every theme at once — only 75 words are five letters in all
 * three languages, so it cannot afford to be choosy — but listing all thirteen
 * subcategories as its hint tells a player nothing at all. Naming the
 * subcategories of the five words actually chosen is the same hint the practice
 * screen and the duel header give.
 */
async function loadWordsFor(subcategoryIds) {
  const { data: links, error: linkError } = await supabase
    .from("words_subcategories")
    .select("word_id, subcategory_id")
    .in("subcategory_id", subcategoryIds);
  if (linkError) fail(`Could not read word links: ${linkError.message}`);

  const subcatsByWord = new Map();
  for (const l of links) {
    if (!subcatsByWord.has(l.word_id)) subcatsByWord.set(l.word_id, new Set());
    subcatsByWord.get(l.word_id).add(l.subcategory_id);
  }

  const ids = [...subcatsByWord.keys()];
  const words = [];
  // PostgREST caps URL length; page through the ids rather than sending them all.
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("words")
      .select("id, word_en, word_sv, word_fr")
      .in("id", ids.slice(i, i + 200));
    if (error) fail(`Could not read words: ${error.message}`);
    words.push(...data);
  }
  return { words, subcatsByWord };
}

/** Reject anything a player could not win: missing translation, wrong length, unkeyable. */
function isPlayable(word, { exactFive }) {
  const langs = [
    ["en", word.word_en],
    ["sv", word.word_sv],
    ["fr", word.word_fr],
  ];

  for (const [lang, raw] of langs) {
    if (!raw) return false;
    const value = raw.trim();
    if (!value) return false;

    if (exactFive) {
      if (value.length !== 5) return false;
    } else if (value.length < MIN_WORD_LENGTH || value.length > MAX_WORD_LENGTH) {
      return false;
    }

    if (untypeableChars(value, lang).length > 0) return false;
  }
  return true;
}

function checkHeadroom(label, available, needed) {
  const required = Math.ceil(needed * REQUIRED_HEADROOM);
  if (available < required) {
    fail(
      `${label}: the schedule needs ${needed} words and only ${available} qualify ` +
        `(${required} required for ${REQUIRED_HEADROOM}x headroom).\n` +
        `  Generating anyway would consume nearly the whole pool, leaving the next batch ` +
        `nothing but repeats. Either add content or lower WEEKS / raise FIVE_EVERY_N_WEEKS ` +
        `at the top of this script.`,
    );
  }
  console.log(`  ${label}: ${available} qualifying words for ${needed} slots — ok.`);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log(`\nWordlune challenge schedule — ${DRY_RUN ? "DRY RUN, nothing will be written" : "LIVE"}\n`);

  const existing = await supabase
    .from("competitive_challenges")
    .select("id, name, start_date")
    .gte("start_date", new Date().toISOString());
  if (existing.error) fail(`Could not check for existing challenges: ${existing.error.message}`);

  if (existing.data.length > 0 && !FORCE && !DRY_RUN) {
    fail(
      `${existing.data.length} challenge(s) are already scheduled from today onward.\n` +
        `  Generating again would double them up. Delete them first, or pass --force if that is what you want.`,
    );
  }

  const byName = await loadSubcategories();
  console.log(`Loaded ${byName.size} subcategories.\n`);

  // Resolve every theme up front so a bad name fails before any word is drawn.
  const themePlans = THEMES.map((t) => ({ ...t, subcategoryIds: resolveTheme(t, byName) }));
  const fivePlan = { ...FIVE_THEME, subcategoryIds: resolveTheme(FIVE_THEME, byName) };

  const fiveCount = Math.floor((WEEKS + FIVE_EVERY_N_WEEKS - 1) / FIVE_EVERY_N_WEEKS);
  console.log(`Planning ${WEEKS} weekly challenges and ${fiveCount} 5x5 challenges.\n`);

  console.log("Checking the word pool:");

  // Per-theme pools, filtered for playability.
  const usedWordIds = new Set();
  const poolByTheme = new Map();
  for (const plan of themePlans) {
    const { words } = await loadWordsFor(plan.subcategoryIds);
    poolByTheme.set(plan.key, words.filter((w) => isPlayable(w, { exactFive: false })));
  }

  const fiveLoad = await loadWordsFor(fivePlan.subcategoryIds);
  const fivePool = fiveLoad.words.filter((w) => isPlayable(w, { exactFive: true }));
  const eligibleSubcatIds = new Set(
    [...byName.values()].filter((s) => s.is_answer_eligible).map((s) => s.id),
  );

  // Each theme is used ceil(WEEKS / THEMES.length) times at most.
  const usesPerTheme = Math.ceil(WEEKS / themePlans.length);
  for (const plan of themePlans) {
    checkHeadroom(
      `Theme "${plan.label}"`,
      poolByTheme.get(plan.key).length,
      usesPerTheme * WORDS_PER_CHALLENGE,
    );
  }
  checkHeadroom("5x5 pool", fivePool.length, fiveCount * WORDS_PER_CHALLENGE);

  // Deterministic per run date, so a dry run and the real run agree.
  const rnd = makeRandom(Number(isoDate(new Date()).replace(/-/g, "")));
  const shuffledByTheme = new Map(
    themePlans.map((p) => [p.key, shuffle(poolByTheme.get(p.key), rnd)]),
  );
  const shuffledFive = shuffle(fivePool, rnd);

  function take(list, n) {
    const picked = [];
    for (const word of list) {
      if (picked.length === n) break;
      if (usedWordIds.has(word.id)) continue;
      usedWordIds.add(word.id);
      picked.push(word);
    }
    if (picked.length < n) {
      fail(`Ran out of unused words while building the schedule (needed ${n}, got ${picked.length}).`);
    }
    return picked;
  }

  const firstMonday = mondayOf(addDays(new Date(), 7));
  const rows = [];

  for (let week = 0; week < WEEKS; week++) {
    const start = addDays(firstMonday, week * 7);
    const end = addDays(start, 7);
    const plan = themePlans[week % themePlans.length];
    const words = take(shuffledByTheme.get(plan.key), WORDS_PER_CHALLENGE);

    rows.push({
      // Deliberately NOT the theme label. The name is the one thing a player
      // sees before starting, and a clock that counts towards the leaderboard
      // starts when they do — "Africa — week of ..." is an invitation to read
      // up on African capitals first. The theme still decides the words and
      // still reaches the player, as a per-word hint once the round is running.
      name: `${WEEKLY_NAME} — ${isoDate(start)}`,
      description: null, // resolved by challenge_menu_stats at read time
      difficulty: plan.difficulty,
      subcategory_ids: plan.subcategoryIds,
      word_ids: words.map((w) => w.id),
      start_date: start.toISOString(),
      end_date: end.toISOString(),
      is_five_chars: false,
      _preview: words.map((w) => w.word_en),
    });

    if (week % FIVE_EVERY_N_WEEKS === 0) {
      const fiveWords = take(shuffledFive, WORDS_PER_CHALLENGE);
      // The subcategories of the words actually drawn, not the whole pool the
      // draw ranged over — see loadWordsFor.
      const fiveSubcatIds = [
        ...new Set(
          fiveWords.flatMap((w) =>
            [...(fiveLoad.subcatsByWord.get(w.id) ?? [])].filter((id) => eligibleSubcatIds.has(id)),
          ),
        ),
      ];
      rows.push({
        // "5x5" is a rule, not content — it says every word is five letters,
        // which the badge already shows and which gives nothing away.
        name: `${FIVE_NAME} — ${isoDate(start)}`,
        description: null,
        difficulty: fivePlan.difficulty,
        subcategory_ids: fiveSubcatIds,
        word_ids: fiveWords.map((w) => w.id),
        start_date: start.toISOString(),
        end_date: end.toISOString(),
        is_five_chars: true,
        _preview: fiveWords.map((w) => w.word_en),
      });
    }
  }

  console.log(`\nBuilt ${rows.length} challenges using ${usedWordIds.size} distinct words.\n`);
  for (const row of rows) {
    console.log(
      `  ${isoDate(new Date(row.start_date))}  ${row.is_five_chars ? "5x5" : "   "}  ` +
        `${row.difficulty.padEnd(6)}  ${row.name}\n        ${row._preview.join(", ")}`,
    );
  }

  if (DRY_RUN) {
    console.log("\nDry run — nothing written. Re-run without --dry-run to insert.\n");
    return;
  }

  const payload = rows.map(({ _preview, ...row }) => row);
  const { error } = await supabase.from("competitive_challenges").insert(payload);
  if (error) fail(`Insert failed: ${error.message}`);

  console.log(`\n✅ Inserted ${payload.length} challenges.`);
  console.log(
    `   The first goes live ${isoDate(firstMonday)}; challenge_menu_stats shows only the ` +
      `active week, so players see one or two at a time.\n`,
  );
}

main().catch((e) => fail(e?.message || String(e)));
