import { type BackendMode, MODE_LABEL, PHASES } from "../lib/identities";
import { Bolt } from "./icons";

const RANGES: Record<string, [number, number]> = {
  SETUP: [0, 5],
  INTERROGATING: [5, 75],
  DELIBERATING: [75, 95],
  VERDICT: [95, 100],
};

function segWidth(phase: string, progress: number): string {
  const [a, b] = RANGES[phase];
  const f = Math.max(0, Math.min(1, (progress - a) / (b - a)));
  return `${f * 100}%`;
}

interface Props {
  phaseIdx: number;
  progress: number;
  banner: string;
  clock: string;
  roundNo: number;
  roundTotal: number;
  revealed: boolean;
  mode: BackendMode | null;
}

export function TopBar({ phaseIdx, progress, banner, clock, roundNo, roundTotal, revealed, mode }: Props) {
  return (
    <div className="topbar">
      <div className="brand">
        <span className="bolt">
          <Bolt />
        </span>
        <div>
          <div className="logo glow-green">TELL</div>
          <div className="sub">AI Interrogation System v1.0</div>
        </div>
      </div>

      <div className="progress-wrap">
        <div className="progress-label">
          <span>{banner || `${PHASES[phaseIdx]}…`}</span>
          <span className="pct">{Math.round(progress)}%</span>
        </div>
        <div className="phases">
          {PHASES.map((p, i) => (
            <div key={p} className={`phase-seg${i < phaseIdx ? " done" : ""}${i === phaseIdx ? " active" : ""}`}>
              <div
                className="fill"
                style={{ width: i === phaseIdx ? segWidth(p, progress) : i < phaseIdx ? "100%" : "0%" }}
              />
              <div className="lab">{p}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="topbar-right">
        <div style={{ textAlign: "right" }}>
          <div className="clock">{clock}</div>
          <div className="round-count">
            ROUND {roundNo} OF {roundTotal}
          </div>
        </div>
        <div className="mode-badge">
          {revealed && mode ? (
            <div className={`mode-back ${mode}`}>
              <span className="mlabel">{MODE_LABEL[mode]}</span>
            </div>
          ) : (
            <div className="mode-front">
              <span className="q">???</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
