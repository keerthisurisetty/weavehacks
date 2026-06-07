import type { IconKind } from "../lib/identities";

const STROKE = {
  fill: "none",
  stroke: "#000",
  strokeWidth: 2.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function DIcon({ kind }: { kind: IconKind }) {
  if (kind === "glass")
    return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <circle cx="10" cy="10" r="6" {...STROKE} />
        <line x1="14.5" y1="14.5" x2="20" y2="20" {...STROKE} />
      </svg>
    );
  if (kind === "layers")
    return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <polygon points="12,3 21,8 12,13 3,8" {...STROKE} />
        <polyline points="3,12 12,17 21,12" {...STROKE} />
        <polyline points="3,16 12,21 21,16" {...STROKE} />
      </svg>
    );
  if (kind === "doc")
    return (
      <svg viewBox="0 0 24 24" width="20" height="20">
        <rect x="5" y="3" width="14" height="18" {...STROKE} />
        <line x1="8" y1="8" x2="16" y2="8" {...STROKE} />
        <line x1="8" y1="12" x2="16" y2="12" {...STROKE} />
        <line x1="8" y1="16" x2="13" y2="16" {...STROKE} />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <polyline points="2,12 7,12 10,4 14,20 17,12 22,12" {...STROKE} />
    </svg>
  );
}

export function Bolt() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24">
      <polygon
        points="13,2 4,14 11,14 9,22 20,9 13,9"
        fill="#00FF88"
        stroke="#000"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 0 6px rgba(0,255,136,.8))" }}
      />
    </svg>
  );
}

export function RobotAvatar() {
  return (
    <svg viewBox="0 0 60 60" width="58" height="58">
      <line x1="30" y1="6" x2="30" y2="14" stroke="#00CFFF" strokeWidth="2.4" />
      <circle cx="30" cy="5" r="3" fill="#00CFFF" stroke="#000" strokeWidth="2" />
      <rect x="12" y="14" width="36" height="30" rx="3" fill="#1c2536" stroke="#000" strokeWidth="3" />
      <rect x="18" y="22" width="9" height="8" rx="1.5" fill="#00FF88" stroke="#000" strokeWidth="2.2" />
      <rect x="33" y="22" width="9" height="8" rx="1.5" fill="#00FF88" stroke="#000" strokeWidth="2.2" />
      <line x1="22" y1="37" x2="38" y2="37" stroke="#000" strokeWidth="2.6" strokeLinecap="round" />
      <rect x="22" y="44" width="16" height="8" rx="2" fill="#2a3650" stroke="#000" strokeWidth="3" />
    </svg>
  );
}

export function SweatDrop() {
  return (
    <svg className="sweat" viewBox="0 0 12 16" width="10" height="13">
      <path
        d="M6 1 C2 7 1 9 1 11 a5 5 0 0 0 10 0 C11 9 10 7 6 1 Z"
        fill="#00CFFF"
        stroke="#000"
        strokeWidth={1.5}
      />
    </svg>
  );
}
