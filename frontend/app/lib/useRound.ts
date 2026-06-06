"use client";

import { useCallback, useRef, useState } from "react";
import type { RoundEvent, Utterance, Verdict } from "./types";

// The reliable fallback transport (PR10 /ws/round). Swap for the AG-UI SSE
// endpoint later without touching the components — they read RoundState only.
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/round";

export type Status = "idle" | "running" | "done" | "error";

export interface RoundState {
  status: Status;
  phase: string;
  progress: number;
  suspicion: Record<string, number>;
  transcript: Utterance[];
  verdict: Verdict | null;
}

const INITIAL: RoundState = {
  status: "idle",
  phase: "setup",
  progress: 0,
  suspicion: {},
  transcript: [],
  verdict: null,
};

function reduce(s: RoundState, ev: RoundEvent): RoundState {
  switch (ev.kind) {
    case "progress":
      return { ...s, phase: ev.phase ?? s.phase, progress: ev.progress ?? s.progress };
    case "utterance":
      return ev.utterance ? { ...s, transcript: [...s.transcript, ev.utterance] } : s;
    case "signal":
      return ev.signal
        ? { ...s, suspicion: { ...s.suspicion, [ev.signal.detector]: ev.signal.suspicion } }
        : s;
    case "verdict":
      return ev.verdict ? { ...s, verdict: ev.verdict, status: "done" } : s;
    default:
      return s;
  }
}

export function useRound(): { state: RoundState; start: () => void } {
  const [state, setState] = useState<RoundState>(INITIAL);
  const wsRef = useRef<WebSocket | null>(null);

  const start = useCallback(() => {
    wsRef.current?.close();
    setState({ ...INITIAL, status: "running" });
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;
    ws.onmessage = (e: MessageEvent) => {
      const ev = JSON.parse(e.data) as RoundEvent;
      setState((s) => reduce(s, ev));
    };
    ws.onclose = () => setState((s) => (s.status === "running" ? { ...s, status: "done" } : s));
    ws.onerror = () => setState((s) => ({ ...s, status: "error" }));
  }, []);

  return { state, start };
}
