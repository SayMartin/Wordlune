import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import {
  createBoardChannel,
  getBoardState,
  getRecentBoardEvents,
  addBoardEvent,
} from "../supabase/words-repository";
import { useLoading } from "../context/LoadingContext";
import { useTranslation } from "react-i18next";

type BoardEvent = any;

export default function useBoardRealtime(boardId: string) {
  const [events, setEvents] = useState<BoardEvent[]>([]);
  const [state, setState] = useState<any>(null);
  const channelRef = useRef<any>(null);
  const { show, hide } = useLoading();
  const { t } = useTranslation();

  useEffect(() => {
    if (!boardId) return;
    show(t("loading_board"));

    const channel = createBoardChannel(boardId);

    // Listen to broadcasted changes from realtime.broadcast_changes
    channel.on("broadcast", { event: "INSERT" }, (payload: any) => {
      const rec = payload?.payload ?? payload?.record ?? payload;
      setEvents((ev) => [rec, ...ev].slice(0, 200));
    });

    // Subscribe to channel and fetch initial data on SUBSCRIBED
    channel.subscribe((status: any) => {
      if (status === "SUBSCRIBED") {
        (async () => {
          try {
            const recent = await getRecentBoardEvents(boardId, 50);
            setEvents(recent ?? []);
            const s = await getBoardState(boardId);
            if (s) setState(s.state);
          } catch (err) {
            // keep console.error but don't throw
            console.error("useBoardRealtime fetch", err);
          } finally {
            hide();
          }
        })();
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [boardId]);

  async function addEvent(eventType: string, payload: any = {}) {
    if (!boardId) throw new Error("Missing boardId");
    try {
      await addBoardEvent(boardId, eventType, payload);
    } catch (err) {
      console.error("addEvent", err);
      throw err;
    }
  }

  return { events, state, setState, addEvent } as const;
}
