/* ============================================================
   TELL — UI components (exported to window for app.jsx)
   ============================================================ */
const { useState, useEffect, useRef } = React;

/* ---- simple bold cartoon icons (thick black stroke) ---- */
function DIcon({ kind }) {
  const common = { fill: 'none', stroke: '#000', strokeWidth: 2.6, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (kind === 'glass') return (
    <svg viewBox="0 0 24 24" width="20" height="20"><circle cx="10" cy="10" r="6" {...common} /><line x1="14.5" y1="14.5" x2="20" y2="20" {...common} /></svg>
  );
  if (kind === 'layers') return (
    <svg viewBox="0 0 24 24" width="20" height="20"><polygon points="12,3 21,8 12,13 3,8" {...common} /><polyline points="3,12 12,17 21,12" {...common} /><polyline points="3,16 12,21 21,16" {...common} /></svg>
  );
  if (kind === 'doc') return (
    <svg viewBox="0 0 24 24" width="20" height="20"><rect x="5" y="3" width="14" height="18" {...common} /><line x1="8" y1="8" x2="16" y2="8" {...common} /><line x1="8" y1="12" x2="16" y2="12" {...common} /><line x1="8" y1="16" x2="13" y2="16" {...common} /></svg>
  );
  // pulse
  return (
    <svg viewBox="0 0 24 24" width="20" height="20"><polyline points="2,12 7,12 10,4 14,20 17,12 22,12" {...common} /></svg>
  );
}

function Bolt() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24"><polygon points="13,2 4,14 11,14 9,22 20,9 13,9" fill="#00FF88" stroke="#000" strokeWidth="2" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px rgba(0,255,136,.8))' }} /></svg>
  );
}

function RobotAvatar() {
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

/* ---- TOP BAR ---- */
function TopBar({ phaseIdx, progress, banner, round, roundNo, roundTotal, clock, revealed, onTraces }) {
  const mode = round.mode;
  return (
    <div className="topbar">
      <div className="brand">
        <span className="bolt"><Bolt /></span>
        <div>
          <div className="logo glow-green">TELL</div>
          <div className="sub">AI Interrogation System v1.0</div>
        </div>
      </div>

      <div className="progress-wrap">
        <div className="progress-label">
          <span>{banner || (PHASES[phaseIdx] + '…')}</span>
          <span className="pct">{Math.round(progress)}%</span>
        </div>
        <div className="phases">
          {PHASES.map((p, i) => (
            <div key={p} className={'phase-seg' + (i < phaseIdx ? ' done' : '') + (i === phaseIdx ? ' active' : '')}>
              <div className="fill" style={{ width: i === phaseIdx ? segWidth(p, progress) : (i < phaseIdx ? '100%' : '0%') }} />
              <div className="lab">{p}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="topbar-right">
        <div style={{ textAlign: 'right' }}>
          <div className="clock">{clock}</div>
          <div className="round-count">ROUND {roundNo} OF {roundTotal}</div>
        </div>
        <div className="mode-badge">
          {revealed
            ? <div className={'mode-back ' + mode}><span className="mlabel">{MODE_LABEL[mode]}</span></div>
            : <div className="mode-front"><span className="q">???</span></div>}
        </div>
      </div>
    </div>
  );
}
function segWidth(phase, progress) {
  // map global 0-100 progress into the active segment's local fill
  const ranges = { SETUP: [0, 5], INTERROGATING: [5, 75], DELIBERATING: [75, 95], VERDICT: [95, 100] };
  const [a, b] = ranges[phase];
  const f = Math.max(0, Math.min(1, (progress - a) / (b - a)));
  return (f * 100) + '%';
}

/* ---- WITNESS ---- */
function Witness({ topic, transcript, current, speaking, hot, revealed }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [transcript, current]);
  return (
    <div className={'witness' + (hot ? ' hot' : '')}>
      <div className="witness-head">
        <div className="avatar">
          <RobotAvatar />
          <svg className="sweat" viewBox="0 0 12 16" width="10" height="13"><path d="M6 1 C2 7 1 9 1 11 a5 5 0 0 0 10 0 C11 9 10 7 6 1 Z" fill="#00CFFF" stroke="#000" strokeWidth="1.5" /></svg>
        </div>
        <div className="witness-meta">
          <div className="name">AGENT WITNESS</div>
          <div className="topic">Topic: {topic}</div>
          <span className={'speak-badge' + (speaking ? '' : ' idle')}>
            {speaking ? 'SPEAKING' : 'STANDING BY'}
            <span className="dots"><span></span><span></span><span></span></span>
          </span>
        </div>
      </div>
      <div className="testimony-head">TESTIMONY <span className="rule"></span></div>
      <div className="transcript" ref={ref}>
        {!revealed && <div className="classified">CLASSIFIED</div>}
        {transcript.map((l, i) => <TLine key={i} line={l} />)}
        {current && <TLine line={current} live />}
      </div>
    </div>
  );
}
function TLine({ line, live }) {
  if (line.who === 'speaker') return <div className="line speaker">{line.text}{live && <span className="caret">|</span>}</div>;
  if (line.who === 'human') return <div className="line human"><span className="tag">[YOU]: </span>{line.text}{live && <span className="caret">|</span>}</div>;
  return <div className="line q">{line.text}{live && <span className="caret">|</span>}</div>;
}

/* ---- DETECTOR CARD ---- */
function fillColor(s) {
  if (s < 0.30) return 'var(--green)';
  if (s < 0.60) return 'var(--yellow)';
  if (s < 0.85) return 'var(--orange)';
  return 'var(--red)';
}
function DetectorCard({ meta, state, decisive }) {
  const s = state.s;
  const flag = s >= 0.85;
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [state.feed.length]);
  return (
    <div className={'dcard' + (flag ? ' flag' : '') + (decisive ? ' decisive' : '') + (state.flash ? ' flash' : '')}>
      <div className="dcard-head" style={{ background: meta.hex }}>
        <span className="ic"><DIcon kind={meta.icon} /></span>
        <div>
          <div className="nm">{meta.name}</div>
          <div className="pn">{meta.persona}</div>
        </div>
      </div>
      <div className="dcard-body">
        <div className="meter-col">
          <div className="meter-num" style={{ color: s >= 0.85 ? 'var(--red)' : 'var(--text)' }}>{Math.round(s * 100)}%</div>
          <div className={'thermo' + (flag ? ' flag' : '')}>
            {[25, 50, 75].map(t => <div key={t} className="tick" style={{ bottom: t + '%' }} />)}
            <div className="fill" style={{ clipPath: `inset(${100 - s * 100}% 0 0 0)`, background: fillColor(s) }} />
          </div>
        </div>
        <div className="feed" ref={ref}>
          {state.feed.length === 0 && <div className="entry" style={{ opacity: .5 }}>[ awaiting testimony ]</div>}
          {state.feed.map((e, i) => (
            <div key={i} className={'entry' + (i === state.feed.length - 1 ? ' fresh' : '') + (e.flag ? ' flagrow' : '')}>
              <span className="ts">[{e.ts}] </span>{e.text}
            </div>
          ))}
        </div>
      </div>
      <div className="dcard-foot">
        <span className={'status-pill ' + (state.status || 'idle')}>{(state.status || 'standby').toUpperCase()}</span>
        <span className="trophy">★ DECISIVE</span>
      </div>
    </div>
  );
}

/* ---- VERDICT GAUGE (speedometer) ---- */
function Gauge({ value }) {
  // value 0..1 (probability deceptive). Needle: -90deg (left/honest) .. +90deg (right/deceptive)
  const cx = 160, cy = 150, R = 120;
  const arc = (f0, f1) => {
    const a0 = Math.PI * (1 - f0), a1 = Math.PI * (1 - f1);
    const x0 = cx + R * Math.cos(a0), y0 = cy - R * Math.sin(a0);
    const x1 = cx + R * Math.cos(a1), y1 = cy - R * Math.sin(a1);
    return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
  };
  const angle = (value - 0.5) * 180;
  return (
    <svg viewBox="0 0 320 172">
      <path d={arc(0, 0.40)} stroke="#00FF88" strokeWidth="20" fill="none" strokeLinecap="butt" opacity="0.95" />
      <path d={arc(0.40, 0.65)} stroke="#FFE600" strokeWidth="20" fill="none" />
      <path d={arc(0.65, 1)} stroke="#FF2D55" strokeWidth="20" fill="none" />
      <path d={arc(0, 1)} stroke="#000" strokeWidth="26" fill="none" opacity="1" style={{ mixBlendMode: 'normal' }} transform="" pointerEvents="none" />
      {/* re-draw colored arc on top of the black outline backing */}
      <path d={arc(0, 0.40)} stroke="#00FF88" strokeWidth="18" fill="none" />
      <path d={arc(0.40, 0.65)} stroke="#FFE600" strokeWidth="18" fill="none" />
      <path d={arc(0.65, 1)} stroke="#FF2D55" strokeWidth="18" fill="none" />
      {/* labels */}
      <text x="14" y="166" fontFamily="Bebas Neue" fontSize="20" fill="#00FF88">HONEST</text>
      <text x="252" y="166" fontFamily="Bebas Neue" fontSize="20" fill="#FF2D55">DECEPTIVE</text>
      {/* center tick */}
      <line x1={cx} y1={cy - R - 4} x2={cx} y2={cy - R + 14} stroke="#000" strokeWidth="3" />
      {/* needle */}
      <g className="needle" transform={`rotate(${angle} ${cx} ${cy})`}>
        <polygon points={`${cx - 6},${cy} ${cx + 6},${cy} ${cx + 2},${cy - R + 6} ${cx - 2},${cy - R + 6}`} fill="#000" />
        <rect x={cx - 3} y={cy - 34} width="6" height="34" fill="#FF2D55" />
      </g>
      <circle cx={cx} cy={cy} r="11" fill="#1A1F2E" stroke="#000" strokeWidth="3" />
    </svg>
  );
}

/* ---- ADJUDICATOR / BOTTOM BAR ---- */
function Adjudicator({ gaugeVal, verdict, verdictFired, onAsk, askable, onRestart, onMenu, onCaseFile, showCaseFile }) {
  const [q, setQ] = useState('');
  const submit = () => { if (q.trim()) { onAsk(q.trim()); setQ(''); } };
  return (
    <div className="adjudicator">
      <div className="verdict-zone">
        <div className="gauge-wrap"><Gauge value={gaugeVal} /></div>
        <div className="verdict-readout">
          <div className="verdict-pre">{verdict ? 'THE PANEL HAS REACHED A VERDICT' : 'THE ADJUDICATOR IS LISTENING…'}</div>
          <div className={'verdict-big' + (verdictFired ? (verdict.label === 'honest' ? ' fire-hon' : ' fire-dec') : '')}>
            {verdict ? `${verdict.head} — ${Math.round(verdict.conf * 100)}%` : '— — —'}
          </div>
          <div className="verdict-sub">
            {verdict
              ? (verdict.decisive ? `Decisive detector: ${DET_NAME[verdict.decisive]}. Confidence ${Math.round(verdict.conf * 100)}%, calibrated.` : 'Reached by panel consensus — no single detector carried the call.')
              : 'Fusing live suspicion signals into a calibrated verdict.'}
          </div>
        </div>
      </div>

      <div className="hitl">
        <div className="h-label">ASK THE WITNESS</div>
        <div className="hitl-row">
          <input value={q} disabled={!askable} placeholder={askable ? 'Type a question to interrogate the witness…' : 'Interjection opens during the interrogation'}
            onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
          <button disabled={!askable} onClick={submit}>INTERJECT</button>
        </div>
        <div className="controls">
          {showCaseFile && <button className="ctl-btn casefile" onClick={onCaseFile}>CASE FILE</button>}
          <button className="ctl-btn ghost" onClick={onMenu}>ROUNDS</button>
          <button className="ctl-btn green" onClick={onRestart}>REPLAY</button>
        </div>
      </div>
    </div>
  );
}
const DET_NAME = { ce: 'Cross-Examiner', ca: 'Consistency Auditor', ev: 'Evidence Checker', ba: 'Behavioral Analyst' };

Object.assign(window, { TopBar, Witness, DetectorCard, Gauge, Adjudicator, DET_NAME, fillColor });
