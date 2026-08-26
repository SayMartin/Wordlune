import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import {
  Match,
  claimVictory,
  recordDuelProgress,
  resolveDuel,
  DUEL_INACTIVITY_SECONDS,
  DUEL_SILENCE_SECONDS,
} from "../supabase/matches-repository";
import { useAuth } from "../context/AuthContext";
import { DUEL_POINTS_CORRECT, DUEL_POINTS_PRESENT } from "../utils/scoring";

interface GameStatePayload {
  row: number;
  evaluations: any[];
  score: number;
}

interface DuelModeProps {
  gameMode: "practice" | "competitive" | "duel";
  activeMatch: Match | null;
  status: "playing" | "won" | "lost" | "idle" | "paused";
  secret: string | null;
  // Callbacks from useGame to control the local board
  pauseGame: () => void;
  resumeGame: () => void;
  startPlaying: () => void;
  resetGame: (
    seed?: string,
    explicitWord?: string,
    isCompetitive?: boolean,
  ) => void;
  giveUpWord: () => void;
  guesses: string[];
  evaluations: any[][];
}

export default function useDuelMode({
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
}: DuelModeProps) {
  const { session } = useAuth() as any;

  const [oppEvaluations, setOppEvaluations] = useState<any[][]>([]);
  const [oppRow, setOppRow] = useState(0);
  const [oppScore, setOppScore] = useState(0);
  const myScore = useMemo(() => {
    if (!evaluations) return 0;
    // `letterStatus`, not `status` — the hook already has a `status` prop
    // holding the round state ("playing"/"won"/...), which is a different thing
    // entirely from a per-letter evaluation.
    return evaluations.flat().reduce((acc: number, letterStatus: string) => {
      if (letterStatus === "correct") return acc + DUEL_POINTS_CORRECT;
      if (letterStatus === "present") return acc + DUEL_POINTS_PRESENT;
      return acc;
    }, 0);
  }, [evaluations]);
  // Both scores mirrored into a ref, and every claimVictory routed through
  // recordVictory below.
  //
  // A ref rather than the state directly because two of the three call sites
  // live inside the realtime channel's subscribe callbacks, which capture their
  // closure once when the channel is set up — reading myScore/oppScore there
  // would persist whatever they were at match start, i.e. 0 and 0. The same
  // trap the elapsed-time ref above already works around.
  const scoresRef = useRef({ mine: 0, opp: 0 });

  const [opponentWon, setOpponentWon] = useState(false);
  const [opponentLost, setOpponentLost] = useState(false);
  const [duelElapsed, setDuelElapsed] = useState(0);
  // Ref to track elapsed time without closure staleness in callbacks
  const duelElapsedRef = useRef(0);

  // Sync Ref with State
  useEffect(() => {
    duelElapsedRef.current = duelElapsed;
  }, [duelElapsed]);

  useEffect(() => {
    scoresRef.current = { mine: myScore, opp: oppScore };
  }, [myScore, oppScore]);

  // The match itself is a prop, and the channel callbacks capture it once too.
  const matchRef = useRef<Match | null>(activeMatch);
  useEffect(() => {
    matchRef.current = activeMatch;
  }, [activeMatch]);

  /**
   * Finish the match AND persist both final scores.
   *
   * Every claimVictory() call in the duel flow goes through here so no path can
   * quietly record a winner with no score. duel_matches stores scores per side
   * (player1_score/player2_score), so the mapping needs to know which side we
   * are — which only the client does.
   *
   * Scores are omitted when the match can't be identified, rather than guessed:
   * a wrong side is worse than a NULL, since NULL already means "duel from
   * before scores were persisted" and the UI handles it.
   */
  const recordVictory = useCallback(
    (matchId: string, winnerId: string) => {
      const match = matchRef.current;
      const myId = session?.user?.id;
      if (!match || match.id !== matchId || !myId) {
        return claimVictory(matchId, winnerId);
      }
      const { mine, opp } = scoresRef.current;
      const iAmPlayer1 = match.player1_id === myId;
      return claimVictory(matchId, winnerId, {
        player1_score: iAmPlayer1 ? mine : opp,
        player2_score: iAmPlayer1 ? opp : mine,
      });
    },
    [session?.user?.id],
  );

  const [matchNames, setMatchNames] = useState<{ p1: string; p2: string }>({
    p1: "",
    p2: "",
  });

  const channelRef = useRef<RealtimeChannel | null>(null);
  const remoteStartRef = useRef(false);
  const nextDuelSecretRef = useRef<string | null>(null);
  const gameOverProcessedRef = useRef(false);
  const hasOpponentJoinedRef = useRef(false);
  const [suddenDeathEndTime, setSuddenDeathEndTime] = useState<
    number | undefined
  >(undefined);

  const [opponentSurrendered, setOpponentSurrendered] = useState(false);
  const [opponentPreStartExit, setOpponentPreStartExit] = useState(false);
  const duelStartedRef = useRef(false);

  // ---- Timeout clocks --------------------------------------------------
  //
  // Two, and they interlock (see 20260828_duel_timeouts.sql):
  //
  //   * 2 minutes of one-sided inactivity forfeits the idle player — but only
  //     while the opponent is still playing. The rule is there to stop one
  //     player stalling while the other works, not to punish a slow duel.
  //   * 8 minutes with NEITHER player acting is decided on proximity. This is
  //     the case the 2-minute rule deliberately leaves alone: with both sides
  //     idle there is no active opponent to hand the win to.
  //
  // The clocks here drive the on-screen countdown and decide *when to ask*. The
  // verdict itself is always the server's — both clients call resolve_duel(),
  // which is row-locked and idempotent, so they cannot disagree.
  const [myLastActivity, setMyLastActivity] = useState(() => Date.now());
  const [oppLastActivity, setOppLastActivity] = useState(() => Date.now());
  const [clockTick, setClockTick] = useState(() => Date.now());
  const [timeoutResult, setTimeoutResult] = useState<{ won: boolean; reason: string } | null>(null);
  const resolveInFlightRef = useRef(false);
  // How many guesses we have already counted as activity. Only an ACCEPTED
  // guess — one that was in the candidate pool and consumed an attempt —
  // resets a clock; see the reporting effect below.
  const reportedGuessCountRef = useRef(0);

  // 1. Fetch Player Names
  useEffect(() => {
    if (activeMatch && activeMatch.player1_id && session?.user?.id) {
      const fetchNames = async () => {
        // Goes through match_player_names(), which checks the caller is a
        // participant of this match before returning either name. Reading
        // player_profiles directly no longer works — the base table is locked
        // to own-row (20260822_gdpr_rls_lockdown.sql), which would leave the
        // opponent showing as "Player 2" forever.
        const { data } = await supabase.rpc("match_player_names", {
          p_match_id: activeMatch.id,
        });

        const map: Record<string, string> = {};
        data?.forEach((p: any) => (map[p.id] = p.display_name));

        setMatchNames({
          p1: map[activeMatch.player1_id!] || "Player 1",
          p2:
            (activeMatch.player2_id && map[activeMatch.player2_id]) ||
            "Player 2",
        });
      };
      fetchNames();
    }
  }, [activeMatch, session?.user?.id]);

  // 2. Sudden Death Timer
  useEffect(() => {
    if (!suddenDeathEndTime || status !== "playing") return;

    const interval = setInterval(() => {
      if (Date.now() >= suddenDeathEndTime) {
        giveUpWord(); // Auto-lose logic
        setSuddenDeathEndTime(undefined);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [suddenDeathEndTime, status, giveUpWord]);

  // 3. Elapsed Timer
  useEffect(() => {
    if (gameMode !== "duel" || status !== "playing") return;
    const interval = setInterval(
      () => setDuelElapsed((prev) => prev + 1),
      1000,
    );
    return () => clearInterval(interval);
  }, [gameMode, status]);

  // 4. Reset Timer on word change
  useEffect(() => {
    if (gameMode === "duel") setDuelElapsed(0);
  }, [secret, gameMode]);

  // Cleanup state when match is null (e.g. returning to lobby)
  useEffect(() => {
    if (gameMode === "duel" && !activeMatch) {
      setOppEvaluations([]);
      setOppRow(0);
      setOppScore(0);
      setDuelElapsed(0);
      setOpponentWon(false);
      setOpponentLost(false);
      setOpponentSurrendered(false);
      setOpponentPreStartExit(false);
      gameOverProcessedRef.current = false;
      hasOpponentJoinedRef.current = false;
      duelStartedRef.current = false;
    }
  }, [gameMode, activeMatch]);

  // 5. Broadcast Start Event
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (gameMode === "duel" && activeMatch) {
      if (status === "playing" && prevStatusRef.current !== "playing") {
        if (!remoteStartRef.current && channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "game_control",
            payload: { type: "start" },
          });
          duelStartedRef.current = true;
        }
      }
      if (status !== "playing") {
        remoteStartRef.current = false;
      }
    }
    prevStatusRef.current = status;
  }, [status, gameMode, activeMatch]);

  // 6. Main Realtime Subscription
  useEffect(() => {
    // Only subscribe if we have a match ID.
    // We rely on activeMatch.id to avoid re-subscribing if values inside activeMatch change but it's the same match.
    if (gameMode !== "duel" || !activeMatch?.id) return;

    const matchId = activeMatch.id;

    // Reset opponent state only on NEW match
    setOppEvaluations([]);
    setOppRow(0);
    setOppScore(0);

    // Only reset timer if we are truly starting a fresh session/match connection
    // However, keeping it 0 here is fine as long as we don't re-run this effect unnecessarily.
    setDuelElapsed(0);

    gameOverProcessedRef.current = false;
    hasOpponentJoinedRef.current = false;
    setOpponentSurrendered(false);

    // const matchId = activeMatch.id; // Already defined above
    const channel = supabase.channel(`game:${matchId}`, {
      config: {
        presence: {
          key: session?.user?.id || `anon-${Math.random()}`,
        },
      },
    });

    channel
      .on(
        "broadcast",
        { event: "guess" },
        ({ payload }: { payload: GameStatePayload }) => {
          setOppEvaluations((prev) => {
            const newEvals = [...prev];
            newEvals[payload.row] = payload.evaluations;
            return newEvals;
          });
          setOppRow(payload.row + 1);
          setOppScore(payload.score);
          // The opponent's clock, reset on the same terms as ours: this
          // broadcast is only sent from the guarded reporting effect below, so
          // it arrives once per ACCEPTED guess and never for a rejected word.
          setOppLastActivity(Date.now());
        },
      )
      .on(
        "broadcast",
        { event: "duel_status" },
        ({ payload }: { payload: { status: string; score?: number } }) => {
          if (typeof payload.score === "number") {
            setOppScore(payload.score);
          }
          if (payload.status === "won") {
            setOpponentWon(true);
            gameOverProcessedRef.current = true;
          } else if (payload.status === "lost") {
            setOpponentLost(true);
            gameOverProcessedRef.current = true;
          }
        },
      )
      .on(
        "broadcast",
        { event: "game_control" },
        ({
          payload,
        }: {
          payload: { type: string; elapsed: number; secret?: string };
        }) => {
          if (payload.type === "pause") {
            pauseGame();
            if (typeof payload.elapsed === "number")
              setDuelElapsed(payload.elapsed);
          } else if (payload.type === "resume") {
            resumeGame();
            if (typeof payload.elapsed === "number")
              setDuelElapsed(payload.elapsed);
          } else if (payload.type === "start") {
            remoteStartRef.current = true;
            duelStartedRef.current = true;
            startPlaying();
            // Start might be 0, or resumed time
            if (typeof payload.elapsed === "number")
              setDuelElapsed(payload.elapsed);
            if (payload.secret) nextDuelSecretRef.current = payload.secret;
          } else if (payload.type === "surrender") {
            gameOverProcessedRef.current = true;
            if (session?.user?.id) {
              recordVictory(matchId, session.user.id);
            }
            setOpponentSurrendered(true);
          }
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users = Object.values(state).flat() as any[];

        if (users.length >= 2) {
          hasOpponentJoinedRef.current = true;
        }

        // If opponent leaves (users.length < 2) AND the game isn't over...
        // We only trigger this if we previously saw the opponent (hasOpponentJoinedRef.current)
        if (
          users.length < 2 &&
          hasOpponentJoinedRef.current &&
          !gameOverProcessedRef.current &&
          session?.user?.id
        ) {
          gameOverProcessedRef.current = true;

          if (duelStartedRef.current) {
            recordVictory(matchId, session.user.id);
            setOpponentSurrendered(true);
          } else {
            // Pre-start abandonment -> Draw/Cancel
            setOpponentPreStartExit(true);
            // Optionally clean up match here or let user confirm
          }
        }
      })
      // `channelStatus` is the Realtime subscription state, not the round's
      // `status` prop and not the presence `status` tracked on the next line —
      // three unrelated meanings of the word within as many lines.
      .subscribe((channelStatus: string) => {
        if (channelStatus === "SUBSCRIBED") {
          channel.track({ user: session?.user?.id, status: "online" });
          channelRef.current = channel;
        }
      });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [
    gameMode,
    activeMatch?.id, // Changed dependency from activeMatch to activeMatch.id
    session?.user?.id,
    // Same-identity-as-session note as the effect below: this does not cause
    // the channel to resubscribe more often than it already would.
    recordVictory,
    // Note: status, pauseGame, etc. are NOT in dependency list to prevent re-subscription on state changes
    // This is intentional. The handlers inside validly form closures, but we don't want to reconnect just because we paused.
    // However, updated handlers are needed for closures.
    // This is a classic React hook trap. If we omit them, the closures inside .on() might be stale.
    // BUT supabase.js event handlers don't need to be recreated if they call stable functions.
    // 'pauseGame' and 'resumeGame' from useGame should be stable (useCallback).
    pauseGame,
    resumeGame,
    startPlaying,
  ]);

  // Broadcast My Moves & Score Calculation
  useEffect(() => {
    if (gameMode !== "duel" || !activeMatch || !channelRef.current) return;
    if (guesses.length === 0) return;

    // ACTIVITY IS AN ACCEPTED GUESS, and this is where that is enforced.
    //
    // useGame's submitGuess refuses any word outside the candidate pool without
    // adding it to `guesses`, so a rejected word must not touch the clocks —
    // otherwise the way to stall forever is to hammer Enter on gibberish, which
    // costs no attempt and would keep resetting the countdown.
    //
    // Today `evaluations` is reducer state whose reference only changes when a
    // guess is accepted, so this effect happens to fire at the right moments
    // already. That is incidental, and a refactor that copied the array on the
    // way out of useGame would silently make the duel clocks unexpirable — a
    // failure nobody would notice until a duel refused to end. Counting the
    // increase explicitly states the rule instead of inheriting it.
    if (guesses.length <= reportedGuessCountRef.current) return;

    const lastRowIndex = guesses.length - 1;
    const lastEvaluation = evaluations[lastRowIndex];
    if (!lastEvaluation) return;

    reportedGuessCountRef.current = guesses.length;

    channelRef.current.send({
      type: "broadcast",
      event: "guess",
      payload: {
        row: lastRowIndex,
        evaluations: lastEvaluation,
        score: myScore,
      },
    });

    setMyLastActivity(Date.now());

    // Also tell the server, which is the only party that can judge a timeout
    // when one of us has stopped responding. Best-guess greens/yellows are the
    // tiebreak — the most in any ONE guess, not the running total, because the
    // score sums every guess and so rewards guessing often over guessing well.
    const best = evaluations.reduce(
      (acc: { correct: number; present: number }, row: any[]) => {
        if (!row) return acc;
        const correct = row.filter((s) => s === "correct").length;
        const present = row.filter((s) => s === "present").length;
        return {
          correct: Math.max(acc.correct, correct),
          present: Math.max(acc.present, present),
        };
      },
      { correct: 0, present: 0 },
    );

    recordDuelProgress(activeMatch.id, {
      guesses: guesses.length,
      bestCorrect: best.correct,
      bestPresent: best.present,
      score: myScore,
    });
  }, [gameMode, activeMatch, guesses.length, evaluations, myScore]);

  // Claim Victory on Win
  useEffect(() => {
    if (gameMode !== "duel" || !activeMatch) return;

    if (status === "won") {
      gameOverProcessedRef.current = true;
      if (session?.user?.id) recordVictory(activeMatch.id, session.user.id);

      // Broadcast Victory immediately so opponent knows
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "duel_status",
          payload: { status: "won", score: myScore },
        });
      }
    } else if (status === "lost") {
      gameOverProcessedRef.current = true;
      // Broadcast Loss so opponent knows (and gets final score)
      if (channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "duel_status",
          payload: { status: "lost", score: myScore },
        });
      }
    }
    // recordVictory only ever changes when session?.user?.id does, which is
    // already a dependency — listing it satisfies the rule without widening
    // when this actually re-runs.
  }, [gameMode, activeMatch, status, session?.user?.id, myScore, recordVictory]);

  // Reset both clocks when a duel starts (or a new word begins).
  useEffect(() => {
    if (gameMode !== "duel") return;
    const now = Date.now();
    setMyLastActivity(now);
    setOppLastActivity(now);
    setClockTick(now);
    setTimeoutResult(null);
    resolveInFlightRef.current = false;
    reportedGuessCountRef.current = 0;
  }, [gameMode, activeMatch?.id, secret]);

  // One tick per second while the duel is live, for the countdown display.
  useEffect(() => {
    if (gameMode !== "duel" || !activeMatch || status !== "playing") return;
    const interval = setInterval(() => setClockTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [gameMode, activeMatch, status]);

  const myIdleSeconds = Math.floor((clockTick - myLastActivity) / 1000);
  const oppIdleSeconds = Math.floor((clockTick - oppLastActivity) / 1000);
  // Time since EITHER of us acted — the 8-minute clock, reset by any guess.
  const quietSeconds = Math.min(myIdleSeconds, oppIdleSeconds);

  // Both players are past the inactivity limit, so neither can be forfeited for
  // it — the rule only fires against a player whose opponent is still going.
  // The 8-minute clock is what decides this one, and the UI dims the two
  // player timers to say so rather than showing two dead countdowns at 0:00.
  const bothIdle =
    myIdleSeconds >= DUEL_INACTIVITY_SECONDS && oppIdleSeconds >= DUEL_INACTIVITY_SECONDS;

  const duelClocks = {
    /** Seconds until the 8-minute silence clock decides on proximity. */
    silenceSecondsLeft: Math.max(0, DUEL_SILENCE_SECONDS - quietSeconds),
    /** Seconds until I forfeit for inactivity. */
    mySecondsLeft: Math.max(0, DUEL_INACTIVITY_SECONDS - myIdleSeconds),
    /** Seconds until the opponent forfeits for inactivity. */
    opponentSecondsLeft: Math.max(0, DUEL_INACTIVITY_SECONDS - oppIdleSeconds),
    /** True when neither inactivity clock can fire — see bothIdle above. */
    inactivityDormant: bothIdle,
  };

  // Ask the server for a verdict once a clock looks spent. It re-checks
  // everything itself and returns the match untouched if we were early, so a
  // clock we run slightly fast costs nothing.
  useEffect(() => {
    if (gameMode !== "duel" || !activeMatch || status !== "playing") return;
    if (gameOverProcessedRef.current || resolveInFlightRef.current) return;

    // One-sided inactivity, or total silence. Both-idle is deliberately not a
    // trigger for the short clock — the server would refuse it anyway, but
    // asking every second for six minutes would be a pointless round trip.
    const oneSidedIdle =
      (myIdleSeconds >= DUEL_INACTIVITY_SECONDS) !== (oppIdleSeconds >= DUEL_INACTIVITY_SECONDS);
    const expired = quietSeconds >= DUEL_SILENCE_SECONDS || oneSidedIdle;
    if (!expired) return;

    resolveInFlightRef.current = true;
    resolveDuel(activeMatch.id).then((match) => {
      if (!match || match.status !== "finished") {
        // Not yet, by the server's reckoning. Allow another attempt on the
        // next tick rather than giving up on the duel entirely.
        resolveInFlightRef.current = false;
        return;
      }
      gameOverProcessedRef.current = true;
      setTimeoutResult({
        won: match.winner_id === session?.user?.id,
        reason: match.finish_reason || "timeout",
      });
    });
  }, [
    gameMode,
    activeMatch,
    status,
    quietSeconds,
    myIdleSeconds,
    oppIdleSeconds,
    session?.user?.id,
  ]);

  // Actions
  const broadcastSurrender = () => {
    if (gameMode === "duel" && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game_control",
        payload: { type: "surrender" },
      });
    }
  };

  const handleDuelPause = () => {
    pauseGame();
    if (gameMode === "duel" && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game_control",
        payload: { type: "pause", elapsed: duelElapsedRef.current },
      });
    }
  };

  const handleDuelResume = () => {
    resumeGame();
    if (gameMode === "duel" && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game_control",
        payload: { type: "resume", elapsed: duelElapsedRef.current },
      });
    }
  };

  const handleDuelStart = () => {
    startPlaying();
    duelStartedRef.current = true;
    if (gameMode === "duel" && channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "game_control",
        payload: {
          type: "start",
          elapsed: 0,
          secret: nextDuelSecretRef.current,
        },
      });
      nextDuelSecretRef.current = null;
    }
  };

  const handleManualReset = (candidatePool: string[] | undefined) => {
    setSuddenDeathEndTime(undefined);
    if (gameMode === "duel" && candidatePool && candidatePool.length > 0) {
      const randomIndex = Math.floor(Math.random() * candidatePool.length);
      const newSecret = candidatePool[randomIndex];
      nextDuelSecretRef.current = newSecret;
      resetGame(undefined, newSecret);
    } else {
      resetGame();
    }
  };

  return {
    oppEvaluations,
    oppRow,
    oppScore,
    duelElapsed,
    matchNames,
    suddenDeathEndTime,
    setSuddenDeathEndTime,
    handleDuelPause,
    handleDuelResume,
    handleDuelStart,
    handleManualReset,
    broadcastSurrender,
    // GameScreen finishes matches too (its own win path and the surrender
    // confirmation). It must go through this rather than claimVictory directly,
    // or those two paths would be the only ones that record no score.
    recordVictory,
    gameOverProcessedRef,
    myScore,
    opponentWon,
    opponentLost,
    opponentSurrendered,
    opponentPreStartExit,
    duelClocks,
    timeoutResult,
    hasDuelStarted: () => duelStartedRef.current,
  };
}
