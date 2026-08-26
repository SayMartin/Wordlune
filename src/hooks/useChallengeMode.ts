import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  saveChallengeResult,
  getChallengeWords,
  startChallenge,
  updateChallengeProgress,
  forfeitChallenge,
  getMyChallengeAttempt,
  ChallengeAttempt,
} from "../supabase/players-repository";
import { computeWordScore } from "../utils/scoring";

interface ChallengeSession {
  id: string;
  attempt: ChallengeAttempt;
  words: string[];
}

interface ChallengeModeProps {
  profile: any;
  i18n: any;
  status: string;
  guesses: string[];
  startTime: number | null;
  endTime: number | null;
  resetGame: (
    seed?: string,
    explicitWord?: string,
    isCompetitive?: boolean,
  ) => void;
  setGameMode: (mode: "practice" | "competitive" | "duel") => void;
  setSaveError: (msg: string | null) => void;
  setSaveSuccess: (msg: string | null) => void;
  setOverrideFive: (val: boolean) => void;
  setShowChallengeSelector: (val: boolean) => void;
}

export default function useChallengeMode({
  profile,
  i18n,
  status,
  guesses,
  startTime,
  endTime,
  resetGame,
  setGameMode,
  setSaveError,
  setSaveSuccess,
  setOverrideFive,
  setShowChallengeSelector,
}: ChallengeModeProps) {
  const { t } = useTranslation();
  const [challengeSession, setChallengeSession] =
    useState<ChallengeSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [showForfeitResult, setShowForfeitResult] = useState(false);

  // `description` used to be threaded through here from the challenge menu and
  // stored on the session, where nothing ever read it. It was the frozen
  // category-name snapshot; challenge_menu_stats resolves names at read time
  // now, so the whole parameter is gone rather than left dangling.
  const handleChallengeSelect = async (
    challengeId: string,
    isFiveChars?: boolean,
  ) => {
    if (!profile?.id) return;
    setLoadingSession(true);
    setLoadingMessage(
      t("game_preparing_challenge", { defaultValue: "Preparing Challenge..." }),
    );

    try {
      if (isFiveChars) {
        setOverrideFive(true);
      } else {
        setOverrideFive(false);
      }

      let attempt = await getMyChallengeAttempt(profile.id, challengeId);
      if (!attempt) {
        const res = await startChallenge(profile.id, challengeId);
        if (res.error || !res.attempt) {
          throw new Error(
            res.error?.message ||
              t("game_could_not_start", "Could not start challenge"),
          );
        }
        attempt = res.attempt;
      }

      if (!attempt)
        throw new Error(t("game_could_not_start", "Could not start challenge"));

      const words = await getChallengeWords(challengeId, i18n.language);
      if (words.length === 0)
        throw new Error(
          t("game_no_words_found", "No words found for challenge"),
        );

      setChallengeSession({
        id: challengeId,
        attempt,
        words,
      });
      setShowChallengeSelector(false);
      setGameMode("competitive");

      // Load current word
      const currentWordIndex = attempt.progress_index;
      if (currentWordIndex < words.length) {
        resetGame(undefined, words[currentWordIndex], true);
      } else {
        setSaveError(
          t("game_challenge_already_completed", "Challenge already completed!"),
        );
      }
    } catch (e: any) {
      console.error(e);
      setSaveError(
        e.message ||
          t("game_failed_load_challenge", "Failed to load challenge"),
      );
      setChallengeSession(null);
      setShowChallengeSelector(true);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleNextChallengeWord = async () => {
    if (!challengeSession || !profile?.id || !startTime) return;
    setLoadingSession(true);
    setLoadingMessage(
      t("game_saving_progress", { defaultValue: "Saving Progress..." }),
    );

    try {
      const { attempt, words } = challengeSession;
      // const currentIndex = attempt.progress_index;
      const won = status === "won";

      const endTimeVal = endTime || Date.now();
      const duration = Math.max(0, Math.floor((endTimeVal - startTime) / 1000));

      // Same formula as practice — see src/utils/scoring.ts. The word length
      // comes from the challenge's own word list rather than from the board,
      // since the secret is per-language and the time allowance scales with it.
      const currentWord = words[attempt.progress_index] || "";
      const scoreVal = computeWordScore({
        won,
        guesses: guesses.length,
        durationSeconds: duration,
        wordLength: currentWord.trim().length || 5,
      }).total;

      // No saveGameScore() here, deliberately: this path only ever runs in
      // competitive mode, and the web app skips saving intermediate words there
      // to avoid cluttering the player's history. Only the aggregate is
      // persisted, by the challenge_results write at the end of the run.

      const newIndex = challengeSession.attempt.progress_index + 1;
      const isFinal = newIndex >= words.length;

      const { success, error: progError } = await updateChallengeProgress(
        attempt.id,
        scoreVal,
        duration,
        guesses.length,
        newIndex,
        isFinal,
      );
      if (progError || !success)
        throw new Error("Failed to update challenge progress");

      if (isFinal) {
        const currentTotalScore = (attempt.total_score || 0) + scoreVal;
        const currentTotalDuration = (attempt.total_duration || 0) + duration;
        const currentTotalGuesses =
          (attempt.total_guesses || 0) + guesses.length;

        const resultData = {
          player_id: profile.id,
          challenge_id: challengeSession.id,
          total_score: currentTotalScore,
          total_duration: currentTotalDuration,
          total_guesses: currentTotalGuesses,
        };
        const { error: summaryError } = await saveChallengeResult(resultData);
        if (summaryError)
          console.error("Failed to save challenge result:", summaryError);
      }

      const updatedAttempt = {
        ...attempt,
        progress_index: newIndex,
        total_score: (attempt.total_score || 0) + scoreVal,
        total_duration: (attempt.total_duration || 0) + duration,
        total_guesses: (attempt.total_guesses || 0) + guesses.length,
      };

      if (newIndex < words.length) {
        const nextWord = words[newIndex];
        setChallengeSession({
          ...challengeSession,
          attempt: updatedAttempt,
        });
        resetGame(undefined, nextWord, true);
      } else {
        // Finished
        setChallengeSession(null);
        setGameMode("practice");
        setSaveSuccess(
          t(
            "game_challenge_complete_check_leaderboard",
            "Challenge Completed! Check your leaderboard.",
          ),
        );
        // We need to return to practice or show a success overlay?
        // Original calls handleModeChange("practice")
      }
    } catch (e: any) {
      console.error(e);
      setSaveError(
        e.message || t("game_error_processing", "Error processing result"),
      );
    } finally {
      setLoadingSession(false);
    }
  };

  const handleForfeit = async (confirmed?: boolean) => {
    if (!challengeSession) return;

    if (!confirmed) {
      // Logic for confirmation dialog needs to be handled by the UI / parent
      // or we return a status indicative of "needs_confirm"
      return;
    }

    setLoadingSession(true);
    try {
      await forfeitChallenge(challengeSession.attempt.id);
      setShowForfeitResult(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingSession(false);
    }
  };

  return {
    challengeSession,
    setChallengeSession,
    loadingSession,
    loadingMessage,
    showForfeitResult,
    setShowForfeitResult,
    handleChallengeSelect,
    handleNextChallengeWord,
    handleForfeit,
  };
}
