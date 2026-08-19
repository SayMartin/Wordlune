import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeForCompare } from "../utils/wordUtils";
import { useTranslation } from "react-i18next";
import useWordPool from "./useWordPool";

type LetterStatus = "absent" | "present" | "correct";

const STORAGE_KEY = "wordlune:game:v1";

interface PersistedState {
  secret: string;
  guesses: string[];
  evaluations: LetterStatus[][];
  currentGuess: string;
  status: "idle" | "playing" | "won" | "lost" | "paused";
  startTime?: number; // timestamp in ms
  endTime?: number; // timestamp in ms
  isCompetitive?: boolean; // New flag to track if this state is for competitive mode
}

function evaluateGuess(secret: string, guess: string): LetterStatus[] {
  const n = Math.max(0, secret.length);
  const res: LetterStatus[] = Array(n).fill("absent");
  const secretChars = secret.split("");
  const guessChars = guess.split("");

  // Normalize hyphen-like and space-like characters so that different
  // dash codepoints in the stored `secret` match the ASCII hyphen the
  // keyboard inserts. Also normalize whitespace to plain space.
  const hyphenRe = /[-‐‑‒–—]/;
  const normalize = (ch: string) => {
    if (!ch) return ch;
    if (hyphenRe.test(ch)) return "-";
    if (ch.trim() === "") return " ";
    return ch;
  };

  const secretNorm = secretChars.map(normalize);
  const guessNorm = guessChars.map(normalize);

  const remaining: Record<string, number> = {};

  // First pass: correct
  for (let i = 0; i < n; i++) {
    const s = secretNorm[i];
    const g = guessNorm[i];
    // If the secret char equals the guess, mark correct.
    // Additionally, if the secret is a hyphen or space, treat any typed
    // (non-empty) guess character as a correct match (so typing '-' or
    // any other character counts as correct for that position).
    if (g && s === g) {
      res[i] = "correct";
      secretNorm[i] = ""; // consume
    } else if (g && (s === "-" || s === " ")) {
      res[i] = "correct";
      secretNorm[i] = ""; // consume (treat as matched)
    } else {
      const ch = secretNorm[i];
      if (ch) remaining[ch] = (remaining[ch] || 0) + 1;
    }
  }

  // Second pass: present/absent
  for (let i = 0; i < n; i++) {
    if (res[i] === "correct") continue;
    const g = guessNorm[i];
    if (g && remaining[g]) {
      res[i] = "present";
      remaining[g]--;
    } else {
      res[i] = "absent";
    }
  }

  return res;
}

async function loadState(): Promise<PersistedState | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedState;
    // simple validation
    if (!parsed.secret) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

function pickFromList(list: string[], seed?: string) {
  if (!list || list.length === 0) return null;
  if (!seed) return list[Math.floor(Math.random() * list.length)];
  // simple deterministic pick from seed
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return list[(h >>> 0) % list.length];
}

function makeNew(
  lang = "en",
  seed?: string,
  explicitSecret?: string,
  isCompetitive?: boolean,
): PersistedState {
  // If no explicit secret and no seed, we might default to "START" or random logic.
  // But for Duel Mode, explicitSecret is mandatory.
  const secret = explicitSecret ?? (seed ? "START" : "START");

  return {
    secret,
    guesses: [],
    evaluations: [],
    currentGuess: "",
    status: "idle",
    isCompetitive: !!isCompetitive,
  };
}

export default function useGame(
  selectedCategoryId?: string | null,
  selectedSubcategoryIds?: string[] | null,
  maxLetters?: number,
  minLetters?: number,
  exactLength?: number | null,
  overrideSecret?: string, // New parameter to force a specific secret (e.g. multiplayer)
  gameModeProp?: "practice" | "competitive" | "duel", // Explicit mode
  overrideLanguage?: string, // Language override for duel mode
) {
  const { t, i18n } = useTranslation();
  // If overrideLanguage provided (e.g. from match), use it. Otherwise i18n.language.
  const rawLang = overrideLanguage || i18n.language || "en";
  const lang = rawLang.split("-")[0].toLowerCase();

  const [state, setState] = useState<PersistedState>(() => {
    // If overrideSecret provided, always start fresh with that secret
    if (overrideSecret) {
      return makeNew(lang, undefined, overrideSecret, true);
    }
    // For Duel Mode, NEVER use persisted state (which might be "TACOS" from practice)
    // We should wait for overrideSecret. If it's missing, start with a placeholder.
    if (gameModeProp === "duel") {
      // Return a temporary "loading" state logic
      return makeNew(lang, undefined, "LOADING", true);
    }
    // AsyncStorage is async, so we can't synchronously restore here like
    // web's localStorage — start fresh and let the effect below hydrate it.
    return makeNew(lang);
  });

  // Hydrate persisted state from AsyncStorage on mount (skipped for duel /
  // overrideSecret, which never use persisted state).
  useEffect(() => {
    let cancelled = false;
    if (overrideSecret || gameModeProp === "duel") return;
    loadState().then((persisted) => {
      if (!cancelled && persisted) setState(persisted);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to handle switching modes (e.g. Practice -> Duel)
  // If we switch to DUEL and don't have an overrideSecret yet, we MUST clear the state associated with Practice.
  useEffect(() => {
    if (
      gameModeProp === "duel" &&
      !overrideSecret &&
      state.secret !== "LOADING"
    ) {
      // We are in duel mode but using a non-loading secret (likely leftover practice word)
      setState(makeNew(lang, undefined, "LOADING", true));
    }
  }, [gameModeProp, overrideSecret, state.secret, lang]);

  // If overrideSecret changes (e.g. starting a match), reset the state immediately
  useEffect(() => {
    if (overrideSecret) {
      setState(makeNew(lang, undefined, overrideSecret, true));
      setUsingFallback(false);
      // setCandidatePool(null); // Managed by useWordPool hook now
    }
  }, [overrideSecret, lang]);

  const {
    candidatePool,
    poolLoading,
    usingFallback: poolUsingFallback,
    initialSecret,
  } = useWordPool({
    lang,
    gameModeProp,
    selectedCategoryId,
    selectedSubcategoryIds,
    maxLetters,
    minLetters,
    exactLength,
    overrideSecret,
    isCompetitiveState: state.isCompetitive,
  });

  const [usingFallback, setUsingFallback] = useState(false);
  const [guessWarning, setGuessWarning] = useState<string | null>(null);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearGuessWarning = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    setGuessWarning(null);
  }, []);

  // Sync fallback state from pool
  useEffect(() => {
    if (poolUsingFallback) setUsingFallback(true);
  }, [poolUsingFallback]);

  // When pool generates a new secret (and we need one), use it.
  useEffect(() => {
    if (!overrideSecret && initialSecret) {
      setState(makeNew(lang, undefined, initialSecret));
      setUsingFallback(false);
    }
  }, [initialSecret, overrideSecret, lang]);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {
      // ignore
    });
  }, [state]);

  const addLetter = useCallback((letter: string) => {
    setState((s) => {
      // Allow typing if 'idle' as well, implicitly starting the game
      if (s.status !== "playing" && s.status !== "idle") return s;

      const nextStatus = s.status === "idle" ? "playing" : s.status;
      const maxLen = Math.max(1, s.secret.length || 5);

      if (s.currentGuess.length >= maxLen) {
        // even if we are full, we might need to update status from idle -> playing?
        // usually unlikely to be full and idle simultaneously unless restored from weird state
        if (s.status === "idle") return { ...s, status: "playing" };
        return s;
      }
      return {
        ...s,
        status: nextStatus,
        currentGuess: (s.currentGuess + letter).toUpperCase().slice(0, maxLen),
      };
    });
  }, []);

  const deleteLetter = useCallback(() => {
    setState((s) => ({ ...s, currentGuess: s.currentGuess.slice(0, -1) }));
  }, []);

  const submitGuess = useCallback(() => {
    setState((s) => {
      if (s.status !== "playing") return s;
      const guess = s.currentGuess.toUpperCase();
      const required = Math.max(1, s.secret.length || 5);
      if (guess.length !== required) return s;

      // If we have a candidatePool, only accept guesses that exist in it
      if (candidatePool && candidatePool.length > 0) {
        const guessNorm = normalizeForCompare(guess);
        const found = candidatePool.some(
          (w) => normalizeForCompare(w) === guessNorm,
        );
        if (!found) {
          // show transient warning to the UI (translated)
          setGuessWarning(t("not_in_pool"));
          if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
          // store timer id so we can clear if another warning appears
          warningTimerRef.current = setTimeout(() => {
            setGuessWarning(null);
            warningTimerRef.current = null;
          }, 3000);
          return s;
        }
      }

      // NOTE: local word lists are minimal. Log if not present locally.
      // try {
      //   if (!isValidWord(lang, guess)) {
      //     // invalid word, but logic suppressed for now
      //   }
      // } catch (e) {
      //   // ignore validation errors
      // }

      const evalRow = evaluateGuess(s.secret, guess);
      const newGuesses = [...s.guesses, guess];
      const newEvals = [...s.evaluations, evalRow];
      const won = evalRow.every((r) => r === "correct");
      const done = won || newGuesses.length >= 6;
      const status: PersistedState["status"] = won
        ? "won"
        : newGuesses.length >= 6
          ? "lost"
          : "playing";

      return {
        ...s,
        guesses: newGuesses,
        evaluations: newEvals,
        currentGuess: "",
        status,
        endTime: done ? Date.now() : undefined,
      };
    });
  }, [candidatePool, lang, t]);

  const resetGame = useCallback(
    (seed?: string, explicitWord?: string, isCompetitive?: boolean) => {
      let explicit: string | undefined = explicitWord;
      if (!explicit && candidatePool && candidatePool.length > 0) {
        explicit = pickFromList(candidatePool, seed) ?? undefined;
      }
      const newState = makeNew(lang, seed, explicit, isCompetitive);

      setState(newState);
    },
    [lang, candidatePool],
  );

  const startPlaying = useCallback(() => {
    setState((s) => ({ ...s, status: "playing", startTime: Date.now() }));
  }, []);

  const pauseGame = useCallback(() => {
    setState((s) => (s.status === "playing" ? { ...s, status: "paused" } : s));
  }, []);

  const resumeGame = useCallback(() => {
    setState((s) => (s.status === "paused" ? { ...s, status: "playing" } : s));
  }, []);

  const giveUpWord = useCallback(() => {
    setState((s) =>
      s.status === "playing"
        ? { ...s, status: "lost", endTime: Date.now() }
        : s,
    );
  }, []);

  const setGameWon = useCallback(() => {
    setState((s) =>
      s.status === "playing" ? { ...s, status: "won", endTime: Date.now() } : s,
    );
  }, []);

  const keyboardState = useMemo(() => {
    const map = new Map<string, LetterStatus>();
    const priority: Record<LetterStatus, number> = {
      absent: 0,
      present: 1,
      correct: 2,
    };
    for (let r = 0; r < state.evaluations.length; r++) {
      const evalRow = state.evaluations[r];
      const guess = state.guesses[r];
      for (let i = 0; i < guess.length; i++) {
        const ch = guess[i];
        const st = evalRow[i];
        const existing = map.get(ch);
        if (!existing || priority[st] > priority[existing]) map.set(ch, st);
        // If this evaluation marks the position correct and the secret
        // contains a hyphen-like or space character at this index, also
        // mark the corresponding keyboard key ('-' or ' ') as correct so
        // the on-screen keys reflect the match.
        if (st === "correct") {
          const sChar = state.secret && state.secret[i];
          if (sChar) {
            const hyphenRe = /[-‐‑‒–—]/;
            if (hyphenRe.test(sChar)) {
              const existingDash = map.get("-");
              if (!existingDash || priority[st] > priority[existingDash])
                map.set("-", st);
            }
            if (sChar.trim() === "") {
              const existingSpace = map.get(" ");
              if (!existingSpace || priority[st] > priority[existingSpace])
                map.set(" ", st);
            }
          }
        }
      }
    }
    // convert to plain object
    const obj: Record<string, LetterStatus> = {};
    map.forEach((v, k) => (obj[k] = v));
    return obj;
  }, [state.evaluations, state.guesses]);

  const attemptsLeft = 6 - state.guesses.length;

  return {
    secret: state.secret,
    guesses: state.guesses,
    evaluations: state.evaluations,
    currentGuess: state.currentGuess,
    status: state.status,
    attemptsLeft,
    keyboardState,
    addLetter,
    deleteLetter,
    submitGuess,
    resetGame,
    startPlaying,
    pauseGame,
    resumeGame,
    giveUpWord: giveUpWord,
    setGameWon,
    usingFallback,
    candidatePool,
    poolLoading,
    guessWarning,
    clearGuessWarning,
    startTime: state.startTime,
    endTime: state.endTime,
  };
}
