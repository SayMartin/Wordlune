import { useState, useEffect } from "react";
import {
  listAllWords,
  listWordsByIds,
  listWordIdsForSubcategories,
  listFiveLetterWords,
  listHydrocarbonFiveLetterWords,
} from "../supabase/words-repository";

// Helper to pick a random word
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

interface UseWordPoolProps {
  lang: string;
  gameModeProp?: "practice" | "competitive" | "duel";
  selectedCategoryId?: string | null;
  selectedSubcategoryIds?: string[] | null;
  maxLetters?: number;
  minLetters?: number;
  exactLength?: number | null;
  overrideSecret?: string;
  isCompetitiveState?: boolean;
}

export default function useWordPool({
  lang,
  gameModeProp,
  selectedCategoryId,
  selectedSubcategoryIds,
  maxLetters,
  minLetters,
  exactLength,
  overrideSecret,
  isCompetitiveState,
}: UseWordPoolProps) {
  const [candidatePool, setCandidatePool] = useState<string[] | null>(null);
  const [poolLoading, setPoolLoading] = useState<boolean>(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [initialSecret, setInitialSecret] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchWords() {
      setPoolLoading(true);
      setUsingFallback(false);

      try {
        // --- DUEL MODE ---
        if (gameModeProp === "duel") {
          const words = await listHydrocarbonFiveLetterWords(lang);
          if (mounted) {
            setCandidatePool(words);

            // If we don't have a secret yet (and no override provided), pick one
            if (!overrideSecret && words.length > 0) {
              setInitialSecret(pickFromList(words) || null);
            }
          }
          return;
        }

        // --- COMPETITIVE MODE ---
        if (gameModeProp === "competitive") {
          const words = await listAllWords(lang);
          if (mounted) {
            setCandidatePool(words);
          }
          return;
        }

        // --- PRACTICE MODE with Secret Override ---
        if (overrideSecret) {
          if (!selectedSubcategoryIds) {
            const words = await listAllWords(lang);
            if (mounted) setCandidatePool(words);
          }
          return;
        }

        // --- PRACTICE MODE Standard ---
        if (!selectedSubcategoryIds) {
          const words = await listAllWords(lang);

          if (words.length === 0) {
            // Fallback handled by parent usually, but we can signal it
            if (mounted) setUsingFallback(true);
            return;
          }

          if (!mounted) return;

          // filter by maxLetters or exactLength if provided
          let filtered = words;

          if (typeof exactLength === "number") {
            filtered = filtered.filter(
              (w: string) => w.replace(/[\s\-]/g, "").length === exactLength,
            );
          } else {
            if (typeof maxLetters === "number") {
              filtered = filtered.filter(
                (w: string) => w.replace(/[\s\-]/g, "").length <= maxLetters,
              );
            }
            if (typeof minLetters === "number") {
              filtered = filtered.filter(
                (w: string) => w.replace(/[\s\-]/g, "").length > minLetters,
              );
            }
          }

          setCandidatePool(filtered);
          const chosen = pickFromList(filtered);
          setInitialSecret(chosen || null);
          return;
        }

        if (selectedSubcategoryIds.length === 0) {
          // Explicit empty selection handling
          if (isCompetitiveState) {
            const words = await listFiveLetterWords(lang);
            if (mounted) setCandidatePool(words);
            return;
          }
          setPoolLoading(false);
          return;
        }

        // --- SUB-CATEGORY SELECTION ---
        const ids = await listWordIdsForSubcategories(selectedSubcategoryIds);
        if (ids.length === 0) {
          if (mounted) setUsingFallback(true);
          return;
        }

        const words = await listWordsByIds(ids, lang);
        if (words.length === 0) {
          if (mounted) setUsingFallback(true);
          return;
        }

        if (!mounted) return;

        let filtered = words;

        if (typeof exactLength === "number") {
          filtered = filtered.filter(
            (w: string) => w.replace(/[\s\-]/g, "").length === exactLength,
          );
        } else {
          if (typeof maxLetters === "number") {
            filtered = filtered.filter(
              (w: string) => w.replace(/[\s\-]/g, "").length <= maxLetters,
            );
          }
          if (typeof minLetters === "number") {
            filtered = filtered.filter(
              (w: string) => w.replace(/[\s\-]/g, "").length > minLetters,
            );
          }
        }

        setCandidatePool(filtered);
        const chosen = pickFromList(filtered);
        setInitialSecret(chosen || null);
      } catch (err) {
        console.error("useWordPool error", err);
        if (mounted) setUsingFallback(true);
      } finally {
        if (mounted) setPoolLoading(false);
      }
    }

    fetchWords();

    return () => {
      mounted = false;
    };
  }, [
    lang,
    gameModeProp,
    selectedCategoryId,
    selectedSubcategoryIds,
    maxLetters,
    minLetters,
    exactLength,
    overrideSecret,
    isCompetitiveState,
  ]);

  return {
    candidatePool,
    poolLoading,
    usingFallback,
    initialSecret,
    pickFromList: (seed?: string) =>
      candidatePool ? pickFromList(candidatePool, seed) : null,
  };
}
