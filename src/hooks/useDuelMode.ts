import { useState, useRef, useEffect, useMemo } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";
import { Match, claimVictory } from "../supabase/matches-repository";
import { useAuth } from "../context/AuthContext";

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
      if (letterStatus === "correct") return acc + 5;
      if (letterStatus === "present") return acc + 2;
      return acc;
    }, 0);
  }, [evaluations]);
  const [opponentWon, setOpponentWon] = useState(false);
  const [opponentLost, setOpponentLost] = useState(false);
  const [duelElapsed, setDuelElapsed] = useState(0);
  // Ref to track elapsed time without closure staleness in callbacks
  const duelElapsedRef = useRef(0);

  // Sync Ref with State
  useEffect(() => {
    duelElapsedRef.current = duelElapsed;
  }, [duelElapsed]);

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
              claimVictory(matchId, session.user.id);
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
            claimVictory(matchId, session.user.id);
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

    const lastRowIndex = guesses.length - 1;
    const lastEvaluation = evaluations[lastRowIndex];
    if (!lastEvaluation) return;

    channelRef.current.send({
      type: "broadcast",
      event: "guess",
      payload: {
        row: lastRowIndex,
        evaluations: lastEvaluation,
        score: myScore,
      },
    });
  }, [gameMode, activeMatch, guesses.length, evaluations, myScore]);

  // Claim Victory on Win
  useEffect(() => {
    if (gameMode !== "duel" || !activeMatch) return;

    if (status === "won") {
      gameOverProcessedRef.current = true;
      if (session?.user?.id) claimVictory(activeMatch.id, session.user.id);

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
  }, [gameMode, activeMatch, status, session?.user?.id, myScore]);

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
    gameOverProcessedRef,
    myScore,
    opponentWon,
    opponentLost,
    opponentSurrendered,
    opponentPreStartExit,
    hasDuelStarted: () => duelStartedRef.current,
  };
}
