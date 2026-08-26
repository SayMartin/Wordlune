/**
 * The single definition of how points are awarded.
 *
 * This used to live inline in three places — GameScreen's handleSaveScore,
 * useChallengeMode's handleNextChallengeWord, and useDuelMode's per-letter
 * tally — which is exactly why the rules could never be shown to the player:
 * there was no one thing to show. Everything that computes, saves, explains or
 * replays a score now reads from here, so the number in the result overlay,
 * the breakdown modal on Progress and the rules section on About cannot drift
 * apart from what was actually written to the database.
 *
 * Time is part of the score. It was recorded (`game_scores.duration_seconds`,
 * `challenge_attempts.total_duration`) long before it counted for anything,
 * which made "3:42" on a history row look like it mattered when it didn't.
 */

/** Guesses a player gets per word — mirrors the `>= 6` checks in useGame.ts. */
export const MAX_GUESSES = 6;

/** Points for a first-guess win, before any time bonus. */
export const BASE_POINTS = 100;

/** Points lost per guess after the first. */
export const POINTS_PER_EXTRA_GUESS = 10;

/** The most a fast solve can add on top of the guess points. */
export const MAX_TIME_BONUS = 50;

/**
 * Seconds of thinking time granted per letter before the time bonus starts to
 * decay. Per-letter rather than a flat budget because the board is 3–12 letters
 * wide: a flat allowance would hand the bonus to anyone playing short words and
 * deny it to everyone else, which punishes the harder round.
 */
export const FREE_SECONDS_PER_LETTER = 10;

/** Seconds of overtime that cost one point of time bonus. */
export const SECONDS_PER_BONUS_POINT = 2;

/** Duel: points per letter in the right place. */
export const DUEL_POINTS_CORRECT = 5;

/** Duel: points per letter that is in the word but misplaced. */
export const DUEL_POINTS_PRESENT = 2;

export interface ScoreBreakdown {
  /** Points from the guess count alone (100 … 50). */
  guessPoints: number;
  /** Points added for speed (50 … 0). */
  timeBonus: number;
  /** guessPoints + timeBonus, or 0 for a word that was lost or skipped. */
  total: number;
  /** Inputs, kept so the UI can render the arithmetic rather than restate it. */
  guesses: number;
  durationSeconds: number;
  wordLength: number;
  /** Seconds granted before the bonus decays. */
  freeSeconds: number;
  /** Seconds spent past `freeSeconds` (0 when inside the allowance). */
  overtimeSeconds: number;
  won: boolean;
}

/** The theoretical ceiling: solved on the first guess, inside the allowance. */
export const MAX_WORD_SCORE = BASE_POINTS + MAX_TIME_BONUS;

export function guessPoints(guesses: number): number {
  const used = Math.max(1, Math.min(MAX_GUESSES, guesses));
  return BASE_POINTS - (used - 1) * POINTS_PER_EXTRA_GUESS;
}

export function freeSeconds(wordLength: number): number {
  return Math.max(1, wordLength) * FREE_SECONDS_PER_LETTER;
}

export function timeBonus(durationSeconds: number, wordLength: number): number {
  const overtime = Math.max(0, durationSeconds - freeSeconds(wordLength));
  const penalty = Math.ceil(overtime / SECONDS_PER_BONUS_POINT);
  return Math.max(0, MAX_TIME_BONUS - penalty);
}

/**
 * Score one word. A word that was lost, skipped or given up scores nothing —
 * the breakdown is still returned in full so the modal can show *why* it is
 * zero instead of just printing "0".
 */
export function computeWordScore(params: {
  won: boolean;
  guesses: number;
  durationSeconds: number;
  wordLength: number;
}): ScoreBreakdown {
  const { won, guesses, durationSeconds, wordLength } = params;
  const safeDuration = Math.max(0, Math.floor(durationSeconds || 0));
  const free = freeSeconds(wordLength);
  const gp = guessPoints(guesses);
  const tb = timeBonus(safeDuration, wordLength);

  return {
    guessPoints: won ? gp : 0,
    timeBonus: won ? tb : 0,
    total: won ? gp + tb : 0,
    guesses,
    durationSeconds: safeDuration,
    wordLength,
    freeSeconds: free,
    overtimeSeconds: Math.max(0, safeDuration - free),
    won,
  };
}

/**
 * Rebuild a breakdown from a stored history row.
 *
 * Rows written before the time bonus existed carry a `score` the current
 * formula cannot produce (they max out at 100). Rather than silently show a
 * recomputed number that disagrees with the stored one, the caller gets both:
 * `total` stays whatever was saved, and `matchesStored` says whether the
 * arithmetic above explains it.
 */
export function explainStoredScore(row: {
  score: number;
  guesses_count?: number | null;
  duration_seconds?: number | null;
  word?: string | null;
  max_letters?: number | null;
}): ScoreBreakdown & { storedScore: number; matchesStored: boolean } {
  const guesses = row.guesses_count ?? 1;
  const duration = row.duration_seconds ?? 0;
  const wordLength = row.word?.trim().length || row.max_letters || 5;
  const computed = computeWordScore({ won: true, guesses, durationSeconds: duration, wordLength });

  return {
    ...computed,
    total: row.score,
    storedScore: row.score,
    matchesStored: computed.total === row.score,
  };
}

/** mm:ss, the format the result overlay and history rows already use. */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
