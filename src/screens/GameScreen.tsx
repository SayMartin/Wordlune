import React, { useCallback, useEffect, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useTheme } from "../theme/ThemeProvider";
import { useAuth } from "../context/AuthContext";
import useGame from "../hooks/useGame";
import useDuelMode from "../hooks/useDuelMode";
import useChallengeMode from "../hooks/useChallengeMode";
import { saveGameScore } from "../supabase/players-repository";
import { getExtensionsForWord } from "../supabase/words-repository";
import { Match, claimVictory, abandonMatch } from "../supabase/matches-repository";
import BoardGrid from "../components/BoardGrid";
import Keyboard from "../components/Keyboard";
import LetterSlider from "../components/LetterSlider";
import CategorySelector from "../components/CategorySelector";
import GameModeToggle from "../components/GameModeToggle";
import ControlDashboard from "../components/ControlDashboard";
import PracticeResultOverlay from "../components/PracticeResultOverlay";
import CompetitiveResultOverlay from "../components/CompetitiveResultOverlay";
import ChallengeSelector from "../components/ChallengeSelector";
import ConfirmationOverlay from "../components/ConfirmationOverlay";
import OverlayMessage from "../components/OverlayMessage";
import DuelLobby from "../components/DuelLobby";
import HostBoard from "../components/HostBoard";
import OpponentBoard from "../components/OpponentBoard";
import type { AppParamList } from "../navigation/types";

type Nav = NativeStackNavigationProp<AppParamList>;
type Mode = "practice" | "competitive" | "duel";

const DEFAULT_MAX_LETTERS = 8;
const ABSOLUTE_MAX_LETTERS = 12;

// Which physically-typed characters count as letters, per language — mirrors
// Keyboard.tsx's LAYOUTS lookup table pattern.
const LETTER_PATTERNS: Record<string, RegExp> = {
  en: /[A-Za-z]/,
  sv: /[A-Za-zÅÄÖåäö]/,
  // Å isn't a native French letter, but word_fr deliberately reuses word_sv's
  // native spelling for Swedish place-name categories (see CLAUDE.md), so it
  // has to be typeable here too.
  fr: /[A-Za-zÀÂÄÅÇÉÈÊËÎÏÔÖÙÛÜŸÆŒàâäåçéèêëîïôöùûüÿæœ]/,
};

export default function GameScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProp<AppParamList, "Game">>();
  const { session, isAuthenticated, authState, profile } = useAuth();

  const [gameMode, setGameMode] = useState<Mode>("practice");
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [modeWarning, setModeWarning] = useState<string | null>(null);

  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[] | null>(null);
  const [maxLetters, setMaxLetters] = useState(DEFAULT_MAX_LETTERS);
  const [minLetters, setMinLetters] = useState(0);
  const [overrideFive, setOverrideFive] = useState(false);
  const [isPracticeHintEnabled, setIsPracticeHintEnabled] = useState(false);
  const [practiceHintSubcategories, setPracticeHintSubcategories] = useState<{ id: string; name: string }[]>([]);
  const [localPoolCount, setLocalPoolCount] = useState<number | null>(null);

  // Result / feedback state declared up front — useChallengeMode below needs
  // several of these setters.
  const [scoreSavedForSecret, setScoreSavedForSecret] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [showResultOverlay, setShowResultOverlay] = useState(false);
  const [showChallengeSelector, setShowChallengeSelector] = useState(false);

  const effectiveMax = gameMode === "duel" ? 5 : overrideFive ? 5 : maxLetters;
  const effectiveMin = gameMode === "duel" ? 4 : overrideFive ? 4 : minLetters;
  const filterMax = overrideFive ? 5 : maxLetters;
  const filterMin = overrideFive ? 4 : minLetters;

  const {
    guesses,
    evaluations,
    currentGuess,
    status,
    keyboardState,
    addLetter,
    deleteLetter,
    submitGuess,
    resetGame,
    startPlaying,
    pauseGame,
    resumeGame,
    giveUpWord,
    secret,
    usingFallback,
    candidatePool,
    poolLoading,
    guessWarning,
    clearGuessWarning,
    startTime,
    endTime,
  } = useGame(
    undefined,
    gameMode === "practice" ? selectedSubcategoryIds : undefined,
    filterMax,
    filterMin,
    gameMode === "duel" ? 5 : overrideFive ? 5 : undefined,
    activeMatch?.secret_word,
    gameMode,
    activeMatch?.language,
  );

  const {
    oppEvaluations,
    oppRow,
    oppScore,
    matchNames,
    duelElapsed,
    handleDuelPause,
    handleDuelResume,
    handleDuelStart,
    handleManualReset: handleDuelReset,
    broadcastSurrender,
    myScore: myDuelScore,
    opponentSurrendered,
    opponentPreStartExit,
    hasDuelStarted,
    opponentWon,
    opponentLost,
    suddenDeathEndTime,
    setSuddenDeathEndTime,
  } = useDuelMode({
    gameMode,
    activeMatch,
    status,
    secret,
    pauseGame,
    resumeGame,
    startPlaying,
    resetGame,
    giveUpWord,
    guesses,
    evaluations,
  });

  const {
    challengeSession,
    setChallengeSession,
    showForfeitResult,
    setShowForfeitResult,
    handleChallengeSelect,
    handleNextChallengeWord,
    handleForfeit,
  } = useChallengeMode({
    profile,
    i18n,
    status,
    guesses,
    startTime: startTime ?? null,
    endTime: endTime ?? null,
    resetGame,
    setGameMode,
    setSaveError,
    setSaveSuccess,
    setOverrideFive,
    setShowChallengeSelector,
  });

  const [competitiveConfirm, setCompetitiveConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [duelResult, setDuelResult] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [suddenDeathNotice, setSuddenDeathNotice] = useState<{ title: string; message: string } | null>(null);

  const backToLobby = useCallback(() => {
    setDuelResult(null);
    setActiveMatch(null);
    resetGame();
  }, [resetGame]);

  useEffect(() => {
    if (gameMode !== "duel" || !activeMatch) return;

    if (opponentSurrendered && status === "playing") {
      setDuelResult({
        title: t("duel_victory_title", { defaultValue: "Victory!" }),
        message: t("duel_opponent_surrendered", { defaultValue: "Your opponent has left the duel. You win!" }),
        onConfirm: backToLobby,
      });
    }

    if (opponentWon && status === "playing") {
      giveUpWord();
    }

    if (opponentLost && status === "playing" && !suddenDeathEndTime) {
      setSuddenDeathEndTime(Date.now() + 60000);
      setSuddenDeathNotice({
        title: t("sudden_death_title", { defaultValue: "Sudden Death!" }),
        message: t("sudden_death_msg", {
          defaultValue: "Opponent failed to find the word! You have 60 seconds to find it and win!",
        }),
      });
    }

    if (status === "won") {
      setDuelResult({
        title: t("duel_victory_title", { defaultValue: "Victory!" }),
        message: t("you_won_duel", { defaultValue: "You found the word first!" }),
        onConfirm: backToLobby,
      });
    }

    if (status === "lost" && opponentWon) {
      setDuelResult({
        title: t("duel_defeat_title", { defaultValue: "Defeat" }),
        message: t("duel_opponent_won", { defaultValue: "Your opponent found the word first." }),
        onConfirm: backToLobby,
      });
    }

    if (status === "lost" && opponentLost) {
      const handleBothLost = async () => {
        const myPoints = myDuelScore;
        const oppPoints = oppScore;
        if (myPoints > oppPoints && session?.user?.id) {
          await claimVictory(activeMatch.id, session.user.id);
        }
        setDuelResult({
          title:
            myPoints > oppPoints
              ? t("victory_points", { defaultValue: "Victory on Points!" })
              : oppPoints > myPoints
                ? t("defeat_points", { defaultValue: "Defeat on Points" })
                : t("draw_points", { defaultValue: "Draw!" }),
          message: `${myPoints} vs ${oppPoints}`,
          onConfirm: backToLobby,
        });
      };
      handleBothLost();
    }

    if (opponentPreStartExit) {
      setDuelResult({
        title: t("duel_draw_title", { defaultValue: "Draw Declared" }),
        message: t("duel_opponent_prestart_exit", { defaultValue: "Opponent left before the duel started. No winner declared." }),
        onConfirm: async () => {
          try {
            await abandonMatch(activeMatch.id);
          } catch {
            // already gone
          }
          backToLobby();
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentSurrendered, opponentWon, opponentLost, opponentPreStartExit, status, activeMatch, gameMode, suddenDeathEndTime, setSuddenDeathEndTime, t]);

  useEffect(() => {
    setShowResultOverlay(status === "won" || status === "lost");
  }, [status]);

  useEffect(() => {
    if (gameMode !== "practice" || !isPracticeHintEnabled || !secret) {
      setPracticeHintSubcategories([]);
      return;
    }
    let cancelled = false;
    const lang = (i18n.language || "en").split("-")[0];
    getExtensionsForWord(secret.trim(), lang).then((data) => {
      if (!cancelled) setPracticeHintSubcategories(data?.subcategories || []);
    });
    return () => {
      cancelled = true;
    };
  }, [gameMode, isPracticeHintEnabled, secret, i18n.language]);

  const isRowFull = status === "playing" && currentGuess.length === (secret?.length || effectiveMax);

  const clientFilteredCount = candidatePool
    ? candidatePool.filter((w) => w.length > effectiveMin && w.length <= effectiveMax).length
    : null;
  const poolCount = clientFilteredCount !== null ? clientFilteredCount : (localPoolCount ?? 0);

  const hasSelection = selectedSubcategoryIds === null || (selectedSubcategoryIds && selectedSubcategoryIds.length > 0);

  const handleSaveScore = useCallback(async () => {
    if (authState === "visitor" || !isAuthenticated || !profile?.id) return;
    if (scoreSavedForSecret === secret) return;

    setSaveError(null);
    try {
      const guessesUsed = guesses.length;
      const calculatedScore = Math.max(10, 100 - (guessesUsed - 1) * 10);
      const duration = startTime && endTime ? Math.floor((endTime - startTime) / 1000) : 0;

      const { data, error } = await saveGameScore({
        player_id: profile.id,
        score: calculatedScore,
        word: secret,
        max_letters: effectiveMax,
        guesses_count: guessesUsed,
        is_always_five_letters: overrideFive,
        game_mode: "practice",
        language: (i18n.language || "en").split("-")[0],
        duration_seconds: duration,
      });

      if (data) {
        setScoreSavedForSecret(secret);
      } else {
        setSaveError(error?.message || t("game_failed_save_score", { defaultValue: "Failed to save score." }));
      }
    } catch (e: any) {
      setSaveError(e?.message || t("game_failed_save_score", { defaultValue: "Failed to save score." }));
    }
  }, [authState, isAuthenticated, profile, scoreSavedForSecret, secret, guesses.length, startTime, endTime, effectiveMax, overrideFive, i18n.language, t]);

  useEffect(() => {
    if (gameMode === "practice" && status === "won" && isAuthenticated) {
      handleSaveScore();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isAuthenticated, gameMode]);

  const handleSelectionChange = useCallback((ids: string[] | null) => setSelectedSubcategoryIds(ids), []);
  const handleCountChange = useCallback((c: number) => setLocalPoolCount(c), []);

  const handleModeChange = (mode: Mode) => {
    if (mode === gameMode) return;
    if ((mode === "duel" || mode === "competitive") && authState !== "registered") {
      setModeWarning(
        mode === "duel"
          ? t("visitor_duel_warning", { defaultValue: "Please log in to play Duel mode!" })
          : t("visitor_competitive_warning", { defaultValue: "Please log in to play Competitive mode!" }),
      );
      return;
    }
    setGameMode(mode);
    setModeWarning(null);
    setActiveMatch(null);

    if (mode === "competitive") {
      setShowChallengeSelector(true);
      setChallengeSession(null);
    } else {
      setShowChallengeSelector(false);
      setChallengeSession(null);
      if (mode !== "duel") resetGame();
    }
  };

  // Home's "Challenge to a Duel" button navigates here with { mode: "duel" }.
  useEffect(() => {
    if (route.params?.mode === "duel") {
      handleModeChange("duel");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.params?.mode]);

  // Physical/computer keyboard support (web only — matches Wordse's Game.tsx
  // `onKey` handler). addLetter/deleteLetter/submitGuess already no-op when
  // the game isn't in a playable state, so no extra gating is needed here.
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const win = (globalThis as any).window;
    if (!win) return;

    function onKey(e: any) {
      const k = e.key;
      if (k === "Enter") {
        e.preventDefault();
        submitGuess();
        return;
      }
      if (k === "Backspace") {
        e.preventDefault();
        deleteLetter();
        return;
      }
      if (k === " ") {
        e.preventDefault();
        addLetter("␣");
        return;
      }
      if (k === "-") {
        e.preventDefault();
        addLetter("‑");
        return;
      }

      if (k.length !== 1) return;

      const lang = (i18n.language || "en").split("-")[0];
      const isLetter = (LETTER_PATTERNS[lang] || LETTER_PATTERNS.en).test(k);
      if (isLetter) addLetter(k.toUpperCase());
    }

    win.addEventListener("keydown", onKey);
    return () => win.removeEventListener("keydown", onKey);
  }, [addLetter, deleteLetter, submitGuess, i18n.language]);

  const handleDuelForfeit = () => {
    if (!activeMatch) return;
    setDuelResult({
      title: t("confirm_surrender_title", { defaultValue: "Surrender?" }),
      message: t("confirm_surrender_msg", { defaultValue: "Are you sure you want to give up? The other player will be declared the winner." }),
      onConfirm: async () => {
        broadcastSurrender();
        const opponentId = session?.user?.id === activeMatch.player1_id ? activeMatch.player2_id : activeMatch.player1_id;
        if (opponentId) await claimVictory(activeMatch.id, opponentId);
        backToLobby();
      },
    });
  };

  const handleDuelExit = () => {
    if (!activeMatch) return;
    if (status === "playing" && hasDuelStarted()) {
      handleDuelForfeit();
      return;
    }
    abandonMatch(activeMatch.id).catch(() => {});
    setActiveMatch(null);
    resetGame();
  };

  const handlePracticeGiveUp = () => {
    setCompetitiveConfirm({
      title: t("confirm_give_up_practice_title", { defaultValue: "Give Up?" }),
      message: t("confirm_give_up_practice_msg", { defaultValue: "The correct answer will be shown." }),
      onConfirm: () => {
        setCompetitiveConfirm(null);
        giveUpWord();
      },
    });
  };

  const handleChallengeGiveUp = () => {
    setCompetitiveConfirm({
      title: t("confirm_give_up_title", { defaultValue: "Give Up Challenge?" }),
      message: t("confirm_give_up_msg", { defaultValue: "You'll forfeit this challenge and won't be able to retry it." }),
      onConfirm: () => {
        setCompetitiveConfirm(null);
        handleForfeit(true);
      },
    });
  };

  const isDuelActive = gameMode === "duel" && !!activeMatch;
  const isCompetitiveActive = gameMode === "competitive" && !!challengeSession && !showChallengeSelector;
  const showPoolSelectors = gameMode === "practice";
  const showBoardArea = showPoolSelectors || isDuelActive || isCompetitiveActive;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        {showPoolSelectors ? (
          <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <CategorySelector
              onChange={handleSelectionChange}
              onCountChange={handleCountChange}
              disabled={status === "playing" || status === "paused"}
              headerContent={<GameModeToggle mode={gameMode} onChange={handleModeChange} disabled={status === "playing" || status === "paused"} />}
              highlightedSubcategoryIds={
                isPracticeHintEnabled ? practiceHintSubcategories.map((s) => s.id) : undefined
              }
            />

            <LetterSlider
              value={effectiveMax}
              minValue={effectiveMin}
              onChange={(min, max) => {
                setMinLetters(Math.max(0, min));
                setMaxLetters(Math.min(ABSOLUTE_MAX_LETTERS, max));
              }}
              min={0}
              max={ABSOLUTE_MAX_LETTERS}
              step={1}
              label={t("max_letters", { defaultValue: "ABC" })}
              count={poolCount}
              disabled={overrideFive || status === "playing" || status === "paused"}
              checkboxDisabled={status === "playing" || status === "paused"}
              overrideChecked={overrideFive}
              onOverrideChange={setOverrideFive}
              overrideLabel={t("force_five", { defaultValue: "Always 5" })}
              showHintToggle
              hintChecked={isPracticeHintEnabled}
              onHintChange={setIsPracticeHintEnabled}
              hintLabel={t("enable_hints", { defaultValue: "Enable Hints" })}
              hintNames={isPracticeHintEnabled ? practiceHintSubcategories.map((s) => s.name) : []}
            />
          </View>
        ) : (
          <GameModeToggle mode={gameMode} onChange={handleModeChange} />
        )}

        {gameMode === "duel" && !activeMatch && (
          <DuelLobby onMatchStart={setActiveMatch} onExit={() => handleModeChange("practice")} />
        )}

        {gameMode === "competitive" && showChallengeSelector && (
          <ChallengeSelector onSelect={handleChallengeSelect} onCancel={() => handleModeChange("practice")} />
        )}

        {gameMode === "competitive" && challengeSession && !showChallengeSelector && (
          <View style={[styles.challengeBanner, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.challengeBannerTitle, { color: colors.text }]}>
              🎯 {t("word_n_of_m", { n: challengeSession.attempt.progress_index + 1, m: challengeSession.words.length, defaultValue: `Word ${challengeSession.attempt.progress_index + 1} of ${challengeSession.words.length}` })}
            </Text>
            {status === "playing" && (
              <Text style={styles.challengeLink} onPress={() => setCompetitiveConfirm({
                title: t("confirm_skip_title", { defaultValue: "Skip Word?" }),
                message: t("confirm_skip_msg", { defaultValue: "You will get 0 points for this word, but can continue the challenge." }),
                onConfirm: () => {
                  setCompetitiveConfirm(null);
                  setShowForfeitResult(false);
                  giveUpWord();
                },
              })}>
                {t("show_word_skip", { defaultValue: "Show Word / Skip" })}
              </Text>
            )}
            <Text style={[styles.challengeLink, styles.challengeGiveUp]} onPress={handleChallengeGiveUp}>
              {t("game_give_up_challenge", { defaultValue: "Give Up Challenge" })}
            </Text>
          </View>
        )}

        {showBoardArea && (
          <>
            {usingFallback && (
              <View style={[styles.banner, { backgroundColor: "#fef3c7" }]}>
                <Text style={{ color: "#92400e" }}>{t("offline_mode", { defaultValue: "Offline mode" })}</Text>
              </View>
            )}

            <ControlDashboard
              gameMode={gameMode}
              status={status}
              secret={secret}
              poolCount={poolCount}
              hasSelection={!!hasSelection}
              poolLoading={poolLoading}
              onReset={() => (gameMode === "duel" ? handleDuelReset(candidatePool ?? undefined) : resetGame())}
              onStart={gameMode === "duel" ? handleDuelStart : startPlaying}
              onPause={gameMode === "duel" ? handleDuelPause : pauseGame}
              onResume={gameMode === "duel" ? handleDuelResume : resumeGame}
              onExit={
                gameMode === "duel"
                  ? handleDuelExit
                  : gameMode === "competitive"
                    ? () => {
                        setChallengeSession(null);
                        setShowChallengeSelector(true);
                      }
                    : () => navigation.navigate("Home")
              }
              elapsedTime={gameMode === "duel" ? duelElapsed : undefined}
              duelOpponentName={
                gameMode === "duel" && activeMatch
                  ? session?.user?.id === activeMatch.player1_id
                    ? matchNames.p2
                    : matchNames.p1
                  : undefined
              }
              onDuelForfeit={handleDuelForfeit}
              language={gameMode === "duel" ? activeMatch?.language : undefined}
              isHintEnabled={gameMode === "duel" ? activeMatch?.is_hint_enabled : isPracticeHintEnabled}
              hideRestart={gameMode === "duel" || gameMode === "competitive"}
              startLabel={gameMode === "competitive" ? t("start_challenge", { defaultValue: "Start Challenge" }) : undefined}
              suddenDeathEndTime={gameMode === "duel" ? suddenDeathEndTime : undefined}
            >
              {gameMode === "practice" && (
                <Pressable
                  onPress={handlePracticeGiveUp}
                  disabled={status !== "playing"}
                  style={[styles.giveUpButton, status !== "playing" && styles.giveUpButtonDisabled]}
                >
                  <Text
                    style={[styles.giveUpButtonText, status !== "playing" && styles.giveUpButtonTextDisabled]}
                  >
                    {t("give_up", { defaultValue: "Give Up" })}
                  </Text>
                </Pressable>
              )}
            </ControlDashboard>

            {gameMode === "duel" ? (
              <View style={styles.duelBoards}>
                <HostBoard
                  match={activeMatch}
                  names={matchNames}
                  score={myDuelScore}
                  guesses={guesses}
                  evaluations={evaluations}
                  currentGuess={currentGuess}
                  secret={secret}
                  userId={session?.user?.id}
                />
                <OpponentBoard
                  evaluations={oppEvaluations}
                  currentInputLength={0}
                  activeRowIndex={oppRow}
                  score={oppScore}
                  playerName={session?.user?.id === activeMatch?.player1_id ? matchNames.p2 : matchNames.p1}
                />
              </View>
            ) : (
              <BoardGrid guesses={guesses} evaluations={evaluations} currentGuess={currentGuess} word={secret} />
            )}

            <Keyboard
              onKey={addLetter}
              onEnter={submitGuess}
              onDelete={deleteLetter}
              state={keyboardState}
              highlightControlKeys={isRowFull}
              language={gameMode === "duel" ? activeMatch?.language : undefined}
            />

            {gameMode === "practice" && status === "won" && isAuthenticated && (
              <View style={styles.saveRow}>
                <Text
                  style={[styles.saveButton, { backgroundColor: scoreSavedForSecret === secret ? "#16a34a" : "#4f46e5" }]}
                  onPress={handleSaveScore}
                >
                  {scoreSavedForSecret === secret
                    ? t("score_saved", { defaultValue: "Score Saved!" })
                    : t("save_score", { defaultValue: "Save Score" })}
                </Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {gameMode === "practice" && showResultOverlay && (status === "won" || status === "lost") && (
        <PracticeResultOverlay
          status={status}
          secret={secret}
          guessesCount={guesses.length}
          score={status === "won" ? Math.max(10, 100 - (guesses.length - 1) * 10) : 0}
          durationSeconds={startTime && endTime ? Math.floor((endTime - startTime) / 1000) : 0}
          onClose={() => setShowResultOverlay(false)}
          isSaved={scoreSavedForSecret === secret}
        />
      )}

      {gameMode === "competitive" && (showResultOverlay || showForfeitResult) && (status === "won" || status === "lost" || showForfeitResult) && (
        <CompetitiveResultOverlay
          status={status as "won" | "lost"}
          secret={secret}
          guessesCount={guesses.length}
          score={showForfeitResult ? 0 : status === "won" ? Math.max(10, 100 - (guesses.length - 1) * 10) : 0}
          durationSeconds={startTime && endTime ? Math.floor((endTime - startTime) / 1000) : 0}
          onNext={
            showForfeitResult
              ? () => {
                  setShowForfeitResult(false);
                  setChallengeSession(null);
                  setShowChallengeSelector(true);
                }
              : handleNextChallengeWord
          }
          isLastWord={!!challengeSession && challengeSession.attempt.progress_index >= challengeSession.words.length - 1}
          isForfeit={!!showForfeitResult}
        />
      )}

      {duelResult && (
        <ConfirmationOverlay
          title={duelResult.title}
          message={duelResult.message}
          onConfirm={duelResult.onConfirm}
          confirmText={t("back_to_lobby", { defaultValue: "Back to Lobby" })}
          variant="info"
        />
      )}

      {competitiveConfirm && (
        <ConfirmationOverlay
          title={competitiveConfirm.title}
          message={competitiveConfirm.message}
          onConfirm={competitiveConfirm.onConfirm}
          onCancel={() => setCompetitiveConfirm(null)}
          variant="warning"
        />
      )}

      {suddenDeathNotice && (
        <ConfirmationOverlay
          title={suddenDeathNotice.title}
          message={suddenDeathNotice.message}
          onConfirm={() => setSuddenDeathNotice(null)}
          variant="warning"
        />
      )}

      {(guessWarning || saveError || saveSuccess || modeWarning) && (
        <OverlayMessage
          message={(saveError || saveSuccess || guessWarning || modeWarning) as string}
          type={saveError ? "error" : saveSuccess ? "success" : "warning"}
          duration={3000}
          onClose={() => {
            clearGuessWarning();
            setSaveError(null);
            setSaveSuccess(null);
            setModeWarning(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: 16, paddingHorizontal: 8, gap: 16, alignItems: "stretch" },
  // Matches ControlDashboard's `bar` card recipe so the filter panel and the
  // play controls read as the same family of surface instead of the filters
  // floating without a background while everything below them is carded.
  filterCard: { borderWidth: 1, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 8, gap: 14 },
  banner: { padding: 10, borderRadius: 8 },
  duelBoards: { flexDirection: "row", justifyContent: "space-around", gap: 12 },
  challengeBanner: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6, alignItems: "center" },
  challengeBannerTitle: { fontWeight: "700", fontSize: 14, textAlign: "center" },
  challengeLink: { color: "#4f46e5", fontSize: 12, fontWeight: "600" },
  challengeGiveUp: { color: "#dc2626" },
  saveRow: { alignItems: "center", marginTop: 4 },
  saveButton: {
    color: "#ffffff",
    fontWeight: "700",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    overflow: "hidden",
  },
  giveUpButton: {
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  giveUpButtonText: { color: "#dc2626", fontWeight: "700", fontSize: 12 },
  // Shared disabled recipe across the app: neutral border + uniform opacity
  // fade, no per-button custom disabled color.
  giveUpButtonDisabled: { borderColor: "#94a3b8", opacity: 0.4 },
  giveUpButtonTextDisabled: { color: "#94a3b8" },
});
