// Semicircular speedometer: HONEST (left, green) -> DECEPTIVE (right, red).
// value = probability deceptive (0..1). Needle rotation via SVG transform attr
// (CSS transform-origin on SVG <g> is unreliable across engines).

const CX = 160;
const CY = 150;
const R = 120;

function arc(f0: number, f1: number): string {
  const a0 = Math.PI * (1 - f0);
  const a1 = Math.PI * (1 - f1);
  const x0 = CX + R * Math.cos(a0);
  const y0 = CY - R * Math.sin(a0);
  const x1 = CX + R * Math.cos(a1);
  const y1 = CY - R * Math.sin(a1);
  return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
}

const BEBAS = { fontFamily: "var(--font-display)" };

export function Gauge({ value }: { value: number }) {
  const angle = (value - 0.5) * 180;
  return (
    <svg viewBox="0 0 320 172">
      <path d={arc(0, 1)} stroke="#000" strokeWidth="26" fill="none" pointerEvents="none" />
      <path d={arc(0, 0.4)} stroke="#00FF88" strokeWidth="18" fill="none" />
      <path d={arc(0.4, 0.65)} stroke="#FFE600" strokeWidth="18" fill="none" />
      <path d={arc(0.65, 1)} stroke="#FF2D55" strokeWidth="18" fill="none" />
      <text x="14" y="166" fontSize="20" fill="#00FF88" style={BEBAS}>
        HONEST
      </text>
      <text x="252" y="166" fontSize="20" fill="#FF2D55" style={BEBAS}>
        DECEPTIVE
      </text>
      <line x1={CX} y1={CY - R - 4} x2={CX} y2={CY - R + 14} stroke="#000" strokeWidth="3" />
      <g className="needle" transform={`rotate(${angle} ${CX} ${CY})`}>
        <polygon
          points={`${CX - 6},${CY} ${CX + 6},${CY} ${CX + 2},${CY - R + 6} ${CX - 2},${CY - R + 6}`}
          fill="#000"
        />
        <rect x={CX - 3} y={CY - 34} width="6" height="34" fill="#FF2D55" />
      </g>
      <circle cx={CX} cy={CY} r="11" fill="#1A1F2E" stroke="#000" strokeWidth="3" />
    </svg>
  );
}
