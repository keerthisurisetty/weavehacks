/* ============================================================
   TELL Courtroom — Characters & props (window-exported)
   ============================================================ */
const { useState: cuS, useEffect: cuE, useRef: cuR } = React;

/* expression params from suspicion level */
function exprFromSus(s, isWitness) {
  if (isWitness) {
    if (s >= 0.85) return 'alarm';
    if (s >= 0.6) return 'sus';
    if (s >= 0.32) return 'watch';
    return 'calm';
  }
  if (s >= 0.85) return 'alarm';
  if (s >= 0.55) return 'sus';
  if (s >= 0.28) return 'watch';
  return 'calm';
}

const EXPR = {
  calm:  { browY: 34, browTilt: 0,  open: 1.0,  pupY: 0,  mouth: 'smile', red: false },
  watch: { browY: 33, browTilt: 4,  open: 0.74, pupY: 2,  mouth: 'flat',  red: false },
  sus:   { browY: 37, browTilt: 16, open: 0.5,  pupY: 1,  mouth: 'frown', red: false },
  alarm: { browY: 27, browTilt: -14,open: 1.3,  pupY: -1, mouth: 'open',  red: true  },
};

function Face({ accent, expr, speaking }) {
  const e = EXPR[expr] || EXPR.calm;
  const sclera = e.red ? '#ffd5dd' : '#ffffff';
  const pupil = e.red ? '#FF2D55' : '#10141f';
  const eyeRy = 10 * e.open;
  // eyebrow endpoints (tilt: positive = inner-down/angry)
  const browL = `M30 ${e.browY + e.browTilt} L48 ${e.browY - e.browTilt}`;
  const browR = `M72 ${e.browY - e.browTilt} L90 ${e.browY + e.browTilt}`;
  let mouth;
  if (speaking) {
    mouth = <ellipse className="mouth-talk" cx="60" cy="84" rx="11" ry="8" fill="#0a0e16" stroke="#000" strokeWidth="2.5" />;
  } else if (e.mouth === 'smile') {
    mouth = <path d="M48 80 Q60 92 72 80" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />;
  } else if (e.mouth === 'flat') {
    mouth = <line x1="49" y1="84" x2="71" y2="84" stroke="#000" strokeWidth="3" strokeLinecap="round" />;
  } else if (e.mouth === 'frown') {
    mouth = <path d="M48 88 Q60 76 72 88" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" />;
  } else {
    mouth = <ellipse cx="60" cy="85" rx="9" ry="11" fill="#0a0e16" stroke="#000" strokeWidth="2.5" />;
  }
  return (
    <g>
      {/* eyes */}
      <ellipse cx="45" cy="56" rx="11" ry={eyeRy} fill={sclera} stroke="#000" strokeWidth="2.5" />
      <ellipse cx="75" cy="56" rx="11" ry={eyeRy} fill={sclera} stroke="#000" strokeWidth="2.5" />
      <circle cx="45" cy={56 + e.pupY * 2} r={e.red ? 3.4 : 5} fill={pupil} />
      <circle cx="75" cy={56 + e.pupY * 2} r={e.red ? 3.4 : 5} fill={pupil} />
      {/* brows */}
      <path d={browL} stroke="#000" strokeWidth="3.4" strokeLinecap="round" />
      <path d={browR} stroke="#000" strokeWidth="3.4" strokeLinecap="round" />
      {mouth}
    </g>
  );
}

/* main character: head + shoulders, role accessories */
function Character({ accent = '#00CFFF', expr = 'calm', speaking = false, role = 'juror', sweat = false, scale = 1 }) {
  const w = 132, h = 150;
  const headFill = '#1c2536';
  return (
    <div className={'char ' + (expr === 'alarm' ? 'alarm' : expr === 'sus' ? 'lean-2' : expr === 'watch' ? 'lean-1' : '')}>
      <svg width={w * scale} height={h * scale} viewBox="0 0 132 150">
        {/* shoulders / torso */}
        <path d="M16 150 Q16 112 40 104 L92 104 Q116 112 116 150 Z" fill={role === 'judge' ? '#11151f' : '#222a40'} stroke="#000" strokeWidth="4" strokeLinejoin="round" />
        {role === 'judge' && <path d="M58 104 L66 124 L74 104 Z" fill="#fff" stroke="#000" strokeWidth="2.5" />}
        {role === 'prosecutor' && <path d="M62 104 L66 132 L70 104 Z" fill={accent} stroke="#000" strokeWidth="2.5" />}
        {/* neck */}
        <rect x="54" y="92" width="24" height="18" fill="#161d2c" stroke="#000" strokeWidth="3" />
        {/* antenna */}
        <line x1="66" y1="18" x2="66" y2="6" stroke="#000" strokeWidth="3" />
        <circle cx="66" cy="5" r="4.5" fill={accent} stroke="#000" strokeWidth="2.5" style={{ filter: `drop-shadow(0 0 5px ${accent})` }} />
        {/* head */}
        <rect x="24" y="20" width="84" height="74" rx="16" fill={headFill} stroke="#000" strokeWidth="4" />
        {/* side ears */}
        <rect x="16" y="46" width="10" height="20" rx="3" fill={accent} stroke="#000" strokeWidth="3" />
        <rect x="106" y="46" width="10" height="20" rx="3" fill={accent} stroke="#000" strokeWidth="3" />
        {/* color brow bar */}
        <rect x="24" y="20" width="84" height="9" rx="4" fill={accent} opacity="0.9" />
        {/* judge wig */}
        {role === 'judge' && (
          <g>
            <ellipse cx="30" cy="58" rx="12" ry="20" fill="#f2f2f2" stroke="#000" strokeWidth="3" />
            <ellipse cx="102" cy="58" rx="12" ry="20" fill="#f2f2f2" stroke="#000" strokeWidth="3" />
            <path d="M24 26 Q66 2 108 26 L108 34 Q66 16 24 34 Z" fill="#f2f2f2" stroke="#000" strokeWidth="3" />
          </g>
        )}
        <Face accent={accent} expr={expr} speaking={speaking} />
        {/* sweat */}
        {sweat && (
          <path className="sweat" d="M100 40 C96 47 95 49 95 51 a4 4 0 0 0 8 0 C103 49 102 47 100 40 Z" fill="#00CFFF" stroke="#000" strokeWidth="1.6" />
        )}
      </svg>
    </div>
  );
}

/* gavel (judge) */
function Gavel({ banged }) {
  return (
    <div className={'gavel-zone' + (banged ? ' bang' : '')}>
      <svg width="92" height="78" viewBox="0 0 92 78">
        <rect x="6" y="64" width="62" height="10" rx="3" fill="#2a3350" stroke="#000" strokeWidth="3" />
        <g>
          <rect x="30" y="30" width="40" height="22" rx="4" fill="#c98a3a" stroke="#000" strokeWidth="4" transform="rotate(-12 50 41)" />
          <rect x="44" y="40" width="9" height="36" rx="3" fill="#8a5a22" stroke="#000" strokeWidth="3.5" transform="rotate(-12 50 58)" />
          <rect x="30" y="30" width="8" height="22" rx="2" fill="#a06b28" stroke="#000" strokeWidth="3" transform="rotate(-12 50 41)" />
        </g>
      </svg>
    </div>
  );
}

/* scales of justice — live truth meter. p = prob deceptive (0..1) */
function Scales({ p, settled }) {
  const deg = (p - 0.5) * 34; // + = LIES (right) sinks
  return (
    <svg viewBox="0 0 320 200">
      {/* base + post */}
      <rect x="138" y="170" width="44" height="14" rx="3" fill="#2a3350" stroke="#000" strokeWidth="3" />
      <rect x="154" y="60" width="12" height="114" fill="#2a3350" stroke="#000" strokeWidth="3" />
      <circle cx="160" cy="58" r="9" fill="#46527a" stroke="#000" strokeWidth="3" />
      {/* rigid beam + hanging pans, rotated as one */}
      <g className="beam" transform={`rotate(${deg} 160 58)`}>
        <rect x="40" y="54" width="240" height="9" rx="4" fill="#5a6699" stroke="#000" strokeWidth="3" />
        <circle cx="48" cy="58" r="5" fill="#1c2536" stroke="#000" strokeWidth="2.5" />
        <circle cx="272" cy="58" r="5" fill="#1c2536" stroke="#000" strokeWidth="2.5" />
        {/* TRUTH pan (left) */}
        <line x1="48" y1="58" x2="32" y2="100" stroke="#000" strokeWidth="2" />
        <line x1="48" y1="58" x2="64" y2="100" stroke="#000" strokeWidth="2" />
        <path d="M22 100 H74 L64 120 H32 Z" fill="#00FF88" stroke="#000" strokeWidth="3" />
        <text x="48" y="115" fontFamily="Bebas Neue" fontSize="13" fill="#000" textAnchor="middle">TRUTH</text>
        {/* LIES pan (right) */}
        <line x1="272" y1="58" x2="256" y2="100" stroke="#000" strokeWidth="2" />
        <line x1="272" y1="58" x2="288" y2="100" stroke="#000" strokeWidth="2" />
        <path d="M246 100 H298 L288 120 H256 Z" fill="#FF2D55" stroke="#000" strokeWidth="3" />
        <text x="272" y="115" fontFamily="Bebas Neue" fontSize="12" fill="#fff" textAnchor="middle">LIES</text>
      </g>
    </svg>
  );
}

/* small detective icons for nameplates / bubbles */
function MiniIcon({ kind }) {
  const c = { fill: 'none', stroke: '#000', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'glass') return <svg viewBox="0 0 24 24" width="14" height="14"><circle cx="10" cy="10" r="6" {...c} /><line x1="14.5" y1="14.5" x2="20" y2="20" {...c} /></svg>;
  if (kind === 'layers') return <svg viewBox="0 0 24 24" width="14" height="14"><polygon points="12,3 21,8 12,13 3,8" {...c} /><polyline points="3,12 12,17 21,12" {...c} /></svg>;
  if (kind === 'doc') return <svg viewBox="0 0 24 24" width="14" height="14"><rect x="5" y="3" width="14" height="18" {...c} /><line x1="8" y1="9" x2="16" y2="9" {...c} /><line x1="8" y1="13" x2="16" y2="13" {...c} /></svg>;
  return <svg viewBox="0 0 24 24" width="14" height="14"><polyline points="2,12 7,12 10,4 14,20 17,12 22,12" {...c} /></svg>;
}

Object.assign(window, { Character, Gavel, Scales, MiniIcon, exprFromSus });
