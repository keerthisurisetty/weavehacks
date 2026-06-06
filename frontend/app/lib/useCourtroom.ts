"use client";

// The courtroom state machine. One state object; two drivers feed it:
//   startLive(caseIdx) — subscribes to the backend WebSocket (the real round)
//   startDemo(caseIdx) — plays a scripted round (deterministic stage failsafe)
// Plus a typewriter for testimony, the verdict "spike", HITL, and a presenter
// jump-to-verdict. A generation counter cancels stale async when a new run starts.

import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_ROUNDS, type DemoStep } from "./demoRounds";
import {
  BACKEND_TO_UI,
  type DetectorKey,
  PHASE_BANNER,
  PHASE_TO_IDX,
  PHASES,
  deriveStatus,
  verdictHead,
} from "./identities";
import type { CourtroomState, DetectorState, Line, RoundEvent, Signal, Verdict } from "./types";

const WS_BASE = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000/ws/round";

const freshDets = (): Record<DetectorKey, DetectorState> => ({
  ce: { s: 0, status: "standby", feed: [], flash: false },
  ca: { s: 0, status: "standby", feed: [], flash: false },
  ev: { s: 0, status: "standby", feed: [], flash: false },
  ba: { s: 0, status: "standby", feed: [], flash: false },
});

const INITIAL: CourtroomState = {
  phaseIdx: 0,
  progress: 0,
  banner: "",
  transcript: [],
  current: null,
  speaking: false,
  dets: freshDets(),
  gauge: 0.5,
  verdict: null,
  verdictFired: false,
  decisive: null,
  revealed: false,
  mode: null,
  groundTruth: null,
  secret: null,
  correct: null,
  vigFire: false,
  clock: "00:00",
  status: "idle",
};

export interface Courtroom {
  state: CourtroomState;
  startLive: (caseIdx: number) => void;
  startDemo: (caseIdx: number) => void;
  ask: (q: string) => void;
  jumpFinal: () => void;
  restart: () => void;
}

export function useCourtroom(): Courtroom {
  const [state, setState] = useState<CourtroomState>(INITIAL);
  const gen = useRef(0);
  const ws = useRef<WebSocket | null>(null);
  const startMs = useRef(0);
  const clockTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const queue = useRef<Line[]>([]);
  const typing = useRef(false);
  const mode = useRef<"live" | "demo">("live");
  const caseIdxRef = useRef(0);

  const patch = useCallback((p: Partial<CourtroomState>) => setState((s) => ({ ...s, ...p })), []);

  const elapsed = useCallback(() => {
    const t = Math.floor((Date.now() - startMs.current) / 1000);
    return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }, []);

  const startClock = useCallback(
    (myGen: number) => {
      startMs.current = Date.now();
      if (clockTimer.current) clearInterval(clockTimer.current);
      clockTimer.current = setInterval(() => {
        if (gen.current === myGen) patch({ clock: elapsed() });
      }, 1000);
    },
    [patch, elapsed],
  );

  const reset = useCallback((): number => {
    gen.current += 1;
    if (clockTimer.current) clearInterval(clockTimer.current);
    if (ws.current) {
      try {
        ws.current.close();
      } catch {
        /* ignore */
      }
      ws.current = null;
    }
    queue.current = [];
    typing.current = false;
    setState({ ...INITIAL, dets: freshDets() });
    return gen.current;
  }, []);

  // ---- typewriter -------------------------------------------------------
  const typeChars = useCallback(
    (line: Line, myGen: number, onDone: () => void) => {
      patch({ speaking: line.who === "speaker" });
      const per = line.who === "speaker" ? 18 : line.who === "human" ? 12 : 30;
      const t0 = Date.now();
      const id = setInterval(() => {
        if (gen.current !== myGen) {
          clearInterval(id);
          return;
        }
        const e = Date.now() - t0;
        const n = Math.min(line.text.length, Math.floor(e / per) + 1);
        patch({ current: { who: line.who, text: line.text.slice(0, n) } });
        if (n >= line.text.length) {
          clearInterval(id);
          window.setTimeout(() => {
            if (gen.current !== myGen) return;
            setState((s) => ({ ...s, transcript: [...s.transcript, line], current: null }));
            onDone();
          }, 260);
        }
      }, 28);
    },
    [patch],
  );

  const pump = useCallback(
    (myGen: number) => {
      if (gen.current !== myGen || typing.current) return;
      const next = queue.current.shift();
      if (!next) {
        patch({ speaking: false });
        return;
      }
      typing.current = true;
      typeChars(next, myGen, () => {
        typing.current = false;
        pump(myGen);
      });
    },
    [patch, typeChars],
  );

  // ---- live event handling ---------------------------------------------
  const applySignal = useCallback(
    (sig: Signal, myGen: number) => {
      const key = BACKEND_TO_UI[sig.detector];
      if (!key) return;
      const s = sig.suspicion;
      const entry = {
        ts: elapsed(),
        text: sig.rationale || (sig.abstained ? "Abstained — nothing to add this turn." : ""),
        flag: s >= 0.85,
      };
      setState((st) => ({
        ...st,
        gauge: sig.abstained ? st.gauge : Math.max(st.gauge, s),
        dets: {
          ...st.dets,
          [key]: { s, status: deriveStatus(s), flash: true, feed: [...st.dets[key].feed, entry] },
        },
      }));
      window.setTimeout(() => {
        if (gen.current === myGen)
          setState((st) => ({ ...st, dets: { ...st.dets, [key]: { ...st.dets[key], flash: false } } }));
      }, 420);
    },
    [elapsed],
  );

  const fireSpike = useCallback(
    (
      myGen: number,
      decisive: DetectorKey | null,
      contributing: DetectorKey[],
      ui: CourtroomState["verdict"],
      gaugeTo: number,
    ) => {
      patch({ verdict: ui, phaseIdx: 3, progress: 100, gauge: gaugeTo });
      window.setTimeout(() => {
        if (gen.current !== myGen) return;
        patch({ verdictFired: true, decisive, vigFire: true });
        window.setTimeout(() => {
          if (gen.current === myGen) patch({ vigFire: false });
        }, 1300);
        contributing.forEach((k) => {
          setState((st) => ({ ...st, dets: { ...st.dets, [k]: { ...st.dets[k], flash: true } } }));
          window.setTimeout(() => {
            if (gen.current === myGen)
              setState((st) => ({ ...st, dets: { ...st.dets, [k]: { ...st.dets[k], flash: false } } }));
          }, 1200);
        });
        if (clockTimer.current) clearInterval(clockTimer.current);
      }, 180);
    },
    [patch],
  );

  const applyVerdict = useCallback(
    (v: Verdict, myGen: number) => {
      const decisive = v.decisive_detector ? (BACKEND_TO_UI[v.decisive_detector] ?? null) : null;
      const contributing = (v.contributing_signals ?? [])
        .map((x) => BACKEND_TO_UI[x.split(":")[0]])
        .filter((k): k is DetectorKey => Boolean(k));
      const gaugeTo = v.label === "honest" ? 1 - v.confidence : v.confidence;
      fireSpike(
        myGen,
        decisive,
        contributing,
        { label: v.label, conf: v.confidence, head: verdictHead(v.label), decisive, contributing },
        gaugeTo,
      );
    },
    [fireSpike],
  );

  const handleEvent = useCallback(
    (ev: RoundEvent, myGen: number) => {
      if (gen.current !== myGen) return;
      if (ev.kind === "progress") {
        const ph = ev.phase ?? "";
        patch({
          phaseIdx: PHASE_TO_IDX[ph] ?? 0,
          banner: PHASE_BANNER[ph] ?? "",
          progress: typeof ev.progress === "number" ? ev.progress : 0,
        });
      } else if (ev.kind === "utterance" && ev.utterance) {
        const r = ev.utterance.role;
        const who: Line["who"] = r === "speaker" ? "speaker" : r === "human" ? "human" : "ce";
        queue.current.push({ who, text: ev.utterance.text });
        pump(myGen);
      } else if (ev.kind === "signal" && ev.signal) {
        applySignal(ev.signal, myGen);
      } else if (ev.kind === "verdict" && ev.verdict) {
        applyVerdict(ev.verdict, myGen);
      } else if (ev.kind === "reveal") {
        setState((s) => ({
          ...s,
          revealed: true,
          mode: ev.mode ?? null,
          groundTruth: ev.ground_truth ?? null,
          secret: ev.secret ?? null,
          correct: ev.correct ?? null,
          status: "done",
        }));
      }
    },
    [patch, pump, applySignal, applyVerdict],
  );

  const startLive = useCallback(
    (caseIdx: number) => {
      const myGen = reset();
      mode.current = "live";
      caseIdxRef.current = caseIdx;
      patch({ status: "running", gauge: 0.5 });
      startClock(myGen);
      let sock: WebSocket;
      try {
        sock = new WebSocket(`${WS_BASE}?case=${caseIdx}`);
      } catch {
        patch({ status: "error" });
        return;
      }
      ws.current = sock;
      sock.onmessage = (e: MessageEvent) => {
        try {
          handleEvent(JSON.parse(e.data) as RoundEvent, myGen);
        } catch {
          /* ignore malformed */
        }
      };
      sock.onerror = () => {
        if (gen.current === myGen) patch({ status: "error" });
      };
      sock.onclose = () => {
        if (gen.current === myGen) setState((s) => (s.status === "running" ? { ...s, status: "done" } : s));
      };
    },
    [reset, patch, startClock, handleEvent],
  );

  // ---- scripted demo driver --------------------------------------------
  const startDemo = useCallback(
    async (caseIdx: number) => {
      const myGen = reset();
      mode.current = "demo";
      caseIdxRef.current = caseIdx;
      patch({ status: "running", gauge: 0.06 });
      startClock(myGen);
      const rnd = DEMO_ROUNDS[caseIdx];
      const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
      const delibIdx = rnd.script.findIndex((s) => s.k === "phase" && s.phase === "DELIBERATING");
      const interEvents = rnd.script.filter(
        (s, i) => (s.k === "say" || s.k === "sig") && i < delibIdx,
      ).length;
      const inc = 70 / Math.max(1, interEvents);
      let prog = 0;

      for (const stp of rnd.script) {
        if (gen.current !== myGen) return;
        if (stp.k === "phase") {
          patch({ phaseIdx: PHASES.indexOf(stp.phase), banner: stp.banner ?? "" });
          if (stp.phase === "SETUP") {
            prog = 5;
            patch({ progress: 5 });
          }
          if (stp.phase === "DELIBERATING") patch({ progress: 80 });
          await delay(420);
        } else if (stp.k === "say") {
          await new Promise<void>((res) => {
            typing.current = true;
            typeChars({ who: stp.who, text: stp.text }, myGen, () => {
              typing.current = false;
              res();
            });
          });
          prog = Math.min(75, prog + inc);
          patch({ progress: prog });
          await delay(200);
        } else if (stp.k === "sig") {
          const s = stp.s;
          const key = stp.d;
          setState((st) => ({
            ...st,
            gauge: Math.max(st.gauge, s),
            dets: {
              ...st.dets,
              [key]: {
                s,
                status: stp.status,
                flash: true,
                feed: [...st.dets[key].feed, { ts: elapsed(), text: stp.r, flag: s >= 0.85 }],
              },
            },
          }));
          window.setTimeout(() => {
            if (gen.current === myGen)
              setState((st) => ({ ...st, dets: { ...st.dets, [key]: { ...st.dets[key], flash: false } } }));
          }, 420);
          prog = Math.min(75, prog + inc);
          patch({ progress: prog });
          await delay(520);
        } else if (stp.k === "beat") {
          await delay(stp.ms);
        } else if (stp.k === "verdict") {
          const gaugeTo = stp.label === "honest" ? 1 - stp.conf : stp.conf;
          fireSpike(
            myGen,
            stp.decisive,
            stp.contributing,
            { label: stp.label, conf: stp.conf, head: stp.head, decisive: stp.decisive, contributing: stp.contributing },
            gaugeTo,
          );
        } else if (stp.k === "reveal") {
          const truthDeceptive = rnd.mode !== "honest";
          setState((st) => ({
            ...st,
            revealed: true,
            mode: rnd.mode,
            groundTruth: truthDeceptive ? "deceptive" : "honest",
            secret: rnd.secret,
            correct: st.verdict ? truthDeceptive === (st.verdict.label !== "honest") : null,
            status: "done",
          }));
        }
      }
    },
    [reset, patch, startClock, typeChars, elapsed, fireSpike],
  );

  const ask = useCallback(
    (q: string) => {
      if (!q.trim()) return;
      if (mode.current === "live") {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: "question", text: q }));
        }
      } else {
        const myGen = gen.current;
        queue.current.push({ who: "human", text: q });
        queue.current.push({
          who: "speaker",
          text: "I believe I've already covered that. The report stands on its own.",
        });
        pump(myGen);
        setState((st) => ({
          ...st,
          dets: {
            ...st.dets,
            ba: {
              ...st.dets.ba,
              s: Math.min(0.95, st.dets.ba.s + 0.05),
              feed: [
                ...st.dets.ba.feed,
                {
                  ts: elapsed(),
                  text: "Human interjection — witness answered without committing to a new specific.",
                  flag: false,
                },
              ],
            },
          },
        }));
      }
    },
    [pump, elapsed],
  );

  // presenter / verification failsafe: jump straight to the scripted final
  const jumpFinal = useCallback(() => {
    const rnd = DEMO_ROUNDS[caseIdxRef.current];
    if (!rnd) return;
    const myGen = (gen.current += 1);
    if (clockTimer.current) clearInterval(clockTimer.current);
    if (ws.current) {
      try {
        ws.current.close();
      } catch {
        /* ignore */
      }
    }
    const dets = freshDets();
    for (const s of rnd.script) {
      if (s.k === "sig") {
        dets[s.d] = { s: s.s, status: s.status, flash: false, feed: [{ ts: "--:--", text: s.r, flag: s.s >= 0.85 }] };
      }
    }
    const transcript: Line[] = [];
    for (const s of rnd.script) if (s.k === "say") transcript.push({ who: s.who, text: s.text });
    const v = rnd.script.find((s): s is Extract<DemoStep, { k: "verdict" }> => s.k === "verdict");
    const truthDeceptive = rnd.mode !== "honest";
    const gaugeTo = v ? (v.label === "honest" ? 1 - v.conf : v.conf) : 0.5;
    setState({
      ...INITIAL,
      phaseIdx: 3,
      progress: 100,
      dets,
      transcript,
      gauge: gaugeTo,
      verdict: v ? { label: v.label, conf: v.conf, head: v.head, decisive: v.decisive, contributing: v.contributing } : null,
      verdictFired: true,
      decisive: v ? v.decisive : null,
      revealed: true,
      mode: rnd.mode,
      groundTruth: truthDeceptive ? "deceptive" : "honest",
      secret: rnd.secret,
      correct: v ? truthDeceptive === (v.label !== "honest") : null,
      vigFire: true,
      status: "done",
    });
    window.setTimeout(() => {
      if (gen.current === myGen) patch({ vigFire: false });
    }, 1300);
  }, [patch]);

  const restart = useCallback(() => {
    if (mode.current === "demo") void startDemo(caseIdxRef.current);
    else startLive(caseIdxRef.current);
  }, [startDemo, startLive]);

  useEffect(
    () => () => {
      gen.current += 1;
      if (clockTimer.current) clearInterval(clockTimer.current);
      if (ws.current) {
        try {
          ws.current.close();
        } catch {
          /* ignore */
        }
      }
    },
    [],
  );

  return { state, startLive, startDemo, ask, jumpFinal, restart };
}
