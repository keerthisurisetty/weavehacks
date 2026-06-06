import { CASES } from "../lib/identities";

interface Props {
  selIdx: number;
  onSelect: (i: number) => void;
  live: boolean;
  onLive: (v: boolean) => void;
  onStart: () => void;
}

export function Overlay({ selIdx, onSelect, live, onLive, onStart }: Props) {
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="big glow-green">TELL</div>
        <div className="tag">A LIVE LIE DETECTOR FOR AI AGENTS</div>
        <div className="desc">
          A panel of detector agents interrogates a witness in real time. Their suspicion meters move
          live — and the instant the witness starts to deceive, the panel converges and calls it. Then
          the truth is revealed.
        </div>

        <div className="overlay-modes">
          <div className={`overlay-mode${live ? " sel" : ""}`} onClick={() => onLive(true)}>
            ● LIVE — real backend
          </div>
          <div className={`overlay-mode${!live ? " sel" : ""}`} onClick={() => onLive(false)}>
            ▶ DEMO — scripted
          </div>
        </div>

        <button className="start-btn" onClick={onStart}>
          ▶ BEGIN INTERROGATION
        </button>

        <div className="round-picker">
          {CASES.map((rd, i) => (
            <div
              key={rd.topic}
              className={`round-pick${i === selIdx ? " sel" : ""}`}
              onClick={() => onSelect(i)}
            >
              <span className="rp-n">CASE 0{i + 1}</span>
              {rd.topic}
            </div>
          ))}
        </div>

        <div
          style={{
            margin: "14px auto 0",
            fontFamily: "var(--font-rationale)",
            fontSize: 11,
            color: "#8899AA",
            maxWidth: 440,
          }}
        >
          {CASES[selIdx].blurb}
          {live ? " — runs the real panel (a few seconds per turn)." : " — deterministic, instant."}
        </div>
      </div>
    </div>
  );
}
