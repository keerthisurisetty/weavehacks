"use client";

import { useState } from "react";
import { DET_NAME } from "../lib/identities";
import type { UiVerdict } from "../lib/types";
import { Gauge } from "./Gauge";

interface Props {
  gauge: number;
  verdict: UiVerdict | null;
  verdictFired: boolean;
  askable: boolean;
  showCaseFile: boolean;
  onAsk: (q: string) => void;
  onRestart: () => void;
  onMenu: () => void;
  onCaseFile: () => void;
}

export function Adjudicator({
  gauge,
  verdict,
  verdictFired,
  askable,
  showCaseFile,
  onAsk,
  onRestart,
  onMenu,
  onCaseFile,
}: Props) {
  const [q, setQ] = useState("");
  const submit = () => {
    if (q.trim()) {
      onAsk(q.trim());
      setQ("");
    }
  };
  const fireClass = verdictFired && verdict ? (verdict.label === "honest" ? " fire-hon" : " fire-dec") : "";

  return (
    <div className="adjudicator">
      <div className="verdict-zone">
        <div className="gauge-wrap">
          <Gauge value={gauge} />
        </div>
        <div className="verdict-readout">
          <div className="verdict-pre">
            {verdict ? "THE PANEL HAS REACHED A VERDICT" : "THE ADJUDICATOR IS LISTENING…"}
          </div>
          <div className={`verdict-big${fireClass}`}>
            {verdict ? `${verdict.head} — ${Math.round(verdict.conf * 100)}%` : "— — —"}
          </div>
          <div className="verdict-sub">
            {verdict
              ? verdict.decisive
                ? `Decisive detector: ${DET_NAME[verdict.decisive]}. Confidence ${Math.round(
                    verdict.conf * 100,
                  )}%, calibrated.`
                : "Reached by panel consensus — no single detector carried the call."
              : "Fusing live suspicion signals into a calibrated verdict."}
          </div>
        </div>
      </div>

      <div className="hitl">
        <div className="h-label">ASK THE WITNESS</div>
        <div className="hitl-row">
          <input
            value={q}
            disabled={!askable}
            placeholder={
              askable
                ? "Type a question to interrogate the witness…"
                : "Interjection opens during the interrogation"
            }
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button disabled={!askable} onClick={submit}>
            INTERJECT
          </button>
        </div>
        <div className="controls">
          {showCaseFile && (
            <button className="ctl-btn casefile" onClick={onCaseFile}>
              CASE FILE
            </button>
          )}
          <button className="ctl-btn ghost" onClick={onMenu}>
            ROUNDS
          </button>
          <button className="ctl-btn green" onClick={onRestart}>
            REPLAY
          </button>
        </div>
      </div>
    </div>
  );
}
