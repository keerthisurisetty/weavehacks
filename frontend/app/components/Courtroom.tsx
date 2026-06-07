"use client";

import { useEffect, useState } from "react";
import { CASES, DETECTORS } from "../lib/identities";
import { useCourtroom } from "../lib/useCourtroom";
import { Adjudicator } from "./Adjudicator";
import { CaseFile } from "./CaseFile";
import { DetectorCard } from "./DetectorCard";
import { Overlay } from "./Overlay";
import { TopBar } from "./TopBar";
import { Witness } from "./Witness";

export function Courtroom() {
  const { state, startLive, startDemo, ask, jumpFinal, restart } = useCourtroom();
  const [overlay, setOverlay] = useState(true);
  const [selIdx, setSelIdx] = useState(1); // default: the strategic-deception hero
  const [live, setLive] = useState(true);
  const [caseOpen, setCaseOpen] = useState(false);

  // presenter failsafe: V jumps straight to the verdict + reveal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "v" || e.key === "V") jumpFinal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [jumpFinal]);

  const hot = Math.max(...DETECTORS.map((d) => state.dets[d.key].s)) >= 0.7;
  const askable = state.phaseIdx === 1 && !state.verdict;

  const begin = () => {
    setOverlay(false);
    setCaseOpen(false);
    if (live) startLive(selIdx);
    else void startDemo(selIdx);
  };

  const next = () => {
    const n = (selIdx + 1) % CASES.length;
    setSelIdx(n);
    setCaseOpen(false);
    if (live) startLive(n);
    else void startDemo(n);
  };

  return (
    <div className="app">
      <div className={`vignette${state.vigFire ? " fire" : ""}`} />

      <TopBar
        phaseIdx={state.phaseIdx}
        progress={state.progress}
        banner={state.banner}
        clock={state.clock}
        roundNo={selIdx + 1}
        roundTotal={CASES.length}
        revealed={state.revealed}
        mode={state.mode}
      />

      <div className="stage">
        <Witness
          topic={CASES[selIdx]?.topic ?? ""}
          transcript={state.transcript}
          current={state.current}
          speaking={state.speaking}
          hot={hot}
          revealed={state.revealed}
        />
        <div className="bureau">
          {DETECTORS.map((m) => (
            <DetectorCard key={m.key} meta={m} state={state.dets[m.key]} decisive={state.decisive === m.key} />
          ))}
        </div>
      </div>

      <Adjudicator
        gauge={state.gauge}
        verdict={state.verdict}
        verdictFired={state.verdictFired}
        askable={askable}
        showCaseFile={state.revealed}
        onAsk={ask}
        onRestart={restart}
        onMenu={() => setOverlay(true)}
        onCaseFile={() => setCaseOpen((o) => !o)}
      />

      {caseOpen && <CaseFile state={state} onClose={() => setCaseOpen(false)} onNext={next} />}
      {overlay && (
        <Overlay selIdx={selIdx} onSelect={setSelIdx} live={live} onLive={setLive} onStart={begin} />
      )}
    </div>
  );
}
