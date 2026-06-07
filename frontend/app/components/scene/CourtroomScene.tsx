// TELL — "Order in the Court" courtroom skin.
//
// Orchestrator ported from the design-handoff prototype
// (docs/tell/design_handoff_courtroom/prototype/courtroom-app.jsx). The
// prototype drove itself from a scripted timeline (`run()`); here that is
// DELETED — the scene is a pure function of useCourtroom().state, which already
// owns the live WS feed, the scripted-demo failsafe, the typewriter, the verdict
// choreography, and HITL. This component only DERIVES the scene's inputs from
// that state and renders the 1600×940 scaled stage.

"use client";

import { useEffect, useState } from "react";
import "../../courtroomScene.css";
import { CASES, DETECTORS, type DetectorKey } from "../../lib/identities";
import type { CourtroomState, Line } from "../../lib/types";
import { useCourtroom } from "../../lib/useCourtroom";
import { exprFromSus, Scales } from "./Characters";
import {
  Bubble,
  type BubbleTail,
  CaseFile,
  InfoPlacard,
  JudgeBench,
  JuryBox,
  Mutter,
  Overlay,
  Podium,
  Rail,
  ROLES,
  WitnessStand,
} from "./parts";

// bubble anchor positions within the 1600×940 stage (from courtroom-app.jsx)
const JCX = [1103, 1263, 1423]; // jury column centers
const ANCH = {
  witness: { left: 95, top: 250, maxWidth: 430, tail: "b-down" as BubbleTail },
  ask: { left: 545, top: 392, maxWidth: 440, tail: "b-down" as BubbleTail },
  mut_ce: { left: 392, top: 556, maxWidth: 212, tail: "b-left" as BubbleTail },
};

// presenter hook: window.__courtFinal() (and the V key) jump to the verdict.
declare global {
  interface Window {
    __courtFinal?: () => void;
  }
}

// most-recent line of a given speaker set, from the live `current` or the transcript
function lastOf(state: CourtroomState, whos: Line["who"][]): Line | null {
  if (state.current && whos.includes(state.current.who)) return state.current;
  for (let i = state.transcript.length - 1; i >= 0; i--) {
    if (whos.includes(state.transcript[i].who)) return state.transcript[i];
  }
  return null;
}

function courtRecord(state: CourtroomState): string {
  const l = state.current ?? state.transcript[state.transcript.length - 1];
  if (!l) return "";
  const tag = l.who === "speaker" ? "WITNESS: " : l.who === "human" ? "[YOU]: " : "EXAMINER: ";
  return `${tag}“${l.text}”`;
}

export function CourtroomScene() {
  const { state, startLive, startDemo, ask, jumpFinal, restart } = useCourtroom();
  const [selIdx, setSelIdx] = useState(1); // default: the strategic-deception hero
  const [overlay, setOverlay] = useState(true);
  const [live, setLive] = useState(true);
  const [caseOpen, setCaseOpen] = useState(false);
  const [scale, setScale] = useState(1);

  // responsive stage scaling — uniform scale-to-fit, letterboxed (port of fit())
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth || document.documentElement.clientWidth || 1440;
      const h = window.innerHeight || document.documentElement.clientHeight || 900;
      const s = Math.min(w / 1600, h / 940);
      if (s > 0) setScale(s);
    };
    fit();
    requestAnimationFrame(fit);
    const t1 = window.setTimeout(fit, 120);
    const t2 = window.setTimeout(fit, 400);
    window.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // presenter / verification failsafe: V (or window.__courtFinal) → jump to verdict
  useEffect(() => {
    window.__courtFinal = () => jumpFinal();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "v" || e.key === "V") jumpFinal();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      delete window.__courtFinal;
    };
  }, [jumpFinal]);

  const begin = () => {
    setOverlay(false);
    setCaseOpen(false);
    if (live) startLive(selIdx);
    else void startDemo(selIdx);
  };

  // Single live exchange: one question, one answer, each detector thinks once,
  // then the verdict — the step-by-step demo round.
  const step = () => {
    setOverlay(false);
    setCaseOpen(false);
    startLive(selIdx, 1);
  };

  const next = () => {
    const n = (selIdx + 1) % CASES.length;
    setSelIdx(n);
    setCaseOpen(false);
    if (live) startLive(n);
    else void startDemo(n);
  };

  // ---- derive scene inputs from live state ----
  const maxSus = Math.max(...DETECTORS.map((d) => state.dets[d.key].s));
  const witnessExpr = exprFromSus(maxSus, true);
  const judgeExpr = state.verdict ? (state.verdict.label === "honest" ? "calm" : "sus") : "calm";
  const askable = state.phaseIdx === 1 && !state.verdict;

  const witnessLine = lastOf(state, ["speaker"]);
  const askLine = lastOf(state, ["ce", "human"]);
  const witnessSpeaking = state.current?.who === "speaker";
  const ceSpeaking = state.current?.who === "ce";

  const flash = state.vigFire ? (state.verdict?.label === "honest" ? "hon" : "dec") : null;

  // latest mutter (rationale) per detector
  const mutterOf = (k: DetectorKey) => {
    const feed = state.dets[k].feed;
    return feed.length ? feed[feed.length - 1] : null;
  };
  const mutCe = mutterOf("ce");

  return (
    <div className="court-scene">
      <div className="scaler">
        <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
          <div className="pillars" />
          <div className="seal">
            <div className="ring">
              ★ COURT OF
              <br />
              VERACITY ★
            </div>
          </div>
          <div className="floor" />

          <div className="zone scales-zone">
            <div className="cap">SCALES OF JUSTICE</div>
            <Scales p={state.gauge} />
            <div className="reading">
              {state.verdict ? "VERDICT RENDERED" : "WEIGHING TESTIMONY — " + Math.round(state.gauge * 100) + "% SUSPECT"}
            </div>
          </div>

          <JudgeBench
            expr={judgeExpr}
            speaking={false}
            banged={state.verdictFired}
            banner={state.verdictFired ? state.verdict : null}
          />

          <InfoPlacard
            phaseIdx={state.phaseIdx}
            progress={state.progress}
            banner={state.banner}
            clock={state.clock}
            roundNo={selIdx + 1}
            roundTotal={CASES.length}
            revealed={state.revealed}
            mode={state.mode}
          />

          <WitnessStand
            topic={CASES[selIdx]?.topic ?? ""}
            expr={witnessExpr}
            speaking={witnessSpeaking}
            hot={maxSus >= 0.7}
          />

          <Podium st={{ ...state.dets.ce, speaking: ceSpeaking }} decisive={state.decisive === "ce"} />

          <JuryBox dets={state.dets} decisive={state.decisive} />

          {/* speech bubbles */}
          {witnessLine && (
            <Bubble
              kind="witness"
              who="WITNESS"
              text={witnessLine.text}
              live={witnessSpeaking}
              tail={ANCH.witness.tail}
              style={{ left: ANCH.witness.left, top: ANCH.witness.top, maxWidth: ANCH.witness.maxWidth }}
            />
          )}
          {askLine && (
            <Bubble
              kind={askLine.who === "human" ? "human" : "ce"}
              who={askLine.who === "human" ? "YOU" : "CROSS-EXAMINER"}
              text={askLine.text}
              live={ceSpeaking}
              tail={ANCH.ask.tail}
              style={{ left: ANCH.ask.left, top: ANCH.ask.top, maxWidth: ANCH.ask.maxWidth }}
            />
          )}

          {/* detector mutters */}
          {mutCe && (
            <Mutter
              text={mutCe.text}
              flag={mutCe.flag}
              style={{ left: ANCH.mut_ce.left, top: ANCH.mut_ce.top, maxWidth: ANCH.mut_ce.maxWidth }}
              tail={{ right: -7, top: 24, transform: "rotate(135deg)" }}
            />
          )}
          {(["ca", "ev", "ba"] as DetectorKey[]).map((k, i) => {
            const m = mutterOf(k);
            return (
              m && (
                <Mutter
                  key={k}
                  text={m.text}
                  flag={m.flag}
                  style={{ left: JCX[i], bottom: 556, maxWidth: 174, transform: "translateX(-50%)" }}
                  tail={{ bottom: -7, left: "50%", marginLeft: -7, transform: "rotate(45deg)" }}
                />
              )
            );
          })}

          <div className={"flash " + (flash === "hon" ? "hon " : "") + (flash ? "fire" : "")} />

          <Rail
            lastLine={courtRecord(state)}
            onAsk={ask}
            askable={askable}
            onReplay={restart}
            onMenu={() => {
              setOverlay(true);
              setSelIdx(selIdx);
            }}
            onCaseFile={() => setCaseOpen((o) => !o)}
            showCase={state.revealed}
          />

          {caseOpen && <CaseFile state={state} onClose={() => setCaseOpen(false)} onNext={next} />}

          {overlay && (
            <Overlay
              selIdx={selIdx}
              setSelIdx={setSelIdx}
              live={live}
              onLive={setLive}
              onStart={begin}
              onStep={step}
            />
          )}
        </div>
      </div>
    </div>
  );
}
