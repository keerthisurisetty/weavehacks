import { DET_NAME, DETECTORS, MODE_LABEL, fillColor } from "../lib/identities";
import type { CourtroomState } from "../lib/types";

interface Props {
  state: CourtroomState;
  onClose: () => void;
  onNext: () => void;
}

export function CaseFile({ state, onClose, onNext }: Props) {
  const { verdict, dets, decisive, mode, secret, correct } = state;
  if (!verdict || !mode) return null;

  const truthDeceptive = mode !== "honest";
  const confPct = Math.round(verdict.conf * 100);
  const ranked = DETECTORS.map((d) => ({ ...d, s: dets[d.key].s })).sort((a, b) => b.s - a.s);
  const bestSingle = ranked[0];
  const singleCatches = truthDeceptive ? bestSingle.s >= 0.85 : bestSingle.s < 0.5;
  const px = 20 + verdict.conf * 240;
  const py = 130 - (correct ? 1 : 0) * 110;

  return (
    <div className="casefile open">
      <div className="cf-inner">
        <button className="ctl-btn ghost cf-close" onClick={onClose}>
          CLOSE ✕
        </button>

        <div className="cf-col">
          <h3>THE CASE FILE</h3>
          <div className={`cf-verdict-badge ${correct ? "ok" : "miss"}`}>
            {correct ? "✓ PANEL CORRECT" : "✕ PANEL MISSED"}
          </div>
          <div className="cf-row">
            <span>Ground truth</span>
            <b>{MODE_LABEL[mode].replace("\n", " ")}</b>
          </div>
          <div className="cf-row">
            <span>Panel verdict</span>
            <b>
              {verdict.head} {confPct}%
            </b>
          </div>
          <div className="cf-row">
            <span>Decisive</span>
            <b>{decisive ? DET_NAME[decisive] : "Consensus"}</b>
          </div>
          <div className="cf-note">
            <b style={{ color: "#fff" }}>The secret:</b> {secret}
          </div>
        </div>

        <div className="cf-col">
          <h3>DETECTIVE PERFORMANCE</h3>
          {ranked.map((d) => (
            <div className="cf-bar" key={d.key}>
              <div className="cf-bl">
                <span>
                  {d.name}
                  {decisive === d.key ? " ★" : ""}
                </span>
                <span>{Math.round(d.s * 100)}%</span>
              </div>
              <div className="cf-track">
                <div className="cf-fill" style={{ width: `${d.s * 100}%`, background: fillColor(d.s) }} />
              </div>
            </div>
          ))}
          <div className="cf-note">
            Best single detector ({bestSingle.name}) would have{" "}
            {singleCatches ? (
              <b style={{ color: "#00FF88" }}>caught it ✓</b>
            ) : (
              <b style={{ color: "#FF2D55" }}>missed it ✕</b>
            )}
            . The panel wins by covering each method&apos;s blind spot.
          </div>
        </div>

        <div className="cf-col">
          <h3>CALIBRATION</h3>
          <svg className="cf-plot" viewBox="0 0 280 150">
            <line x1="20" y1="130" x2="20" y2="14" stroke="#2a3247" strokeWidth="1.5" />
            <line x1="20" y1="130" x2="270" y2="130" stroke="#2a3247" strokeWidth="1.5" />
            <line x1="20" y1="130" x2="260" y2="20" stroke="#55617a" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="110" y="148" fontSize="9" fill="#8899AA" style={{ fontFamily: "var(--font-mono)" }}>
              predicted confidence →
            </text>
            <circle cx={px} cy={py} r="6" fill={correct ? "#00FF88" : "#FF2D55"} stroke="#000" strokeWidth="2" />
          </svg>
          <div className="cf-row" style={{ marginTop: 10 }}>
            <span>This round</span>
            <b>
              {confPct}% · {correct ? "correct" : "wrong"}
            </b>
          </div>
          <div className="cf-note">
            Aggregate accuracy, false-positive rate, and Brier (panel vs. single) are measured over the
            full dataset by <b style={{ color: "#fff" }}>make eval</b> — see the Weave dashboard.
          </div>
          <button
            className="ctl-btn green"
            style={{ marginTop: 16, width: "100%", fontSize: 22 }}
            onClick={onNext}
          >
            NEXT CASE →
          </button>
        </div>
      </div>
    </div>
  );
}
