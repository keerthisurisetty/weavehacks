/* ============================================================
   TELL Courtroom — scene pieces (window-exported)
   ============================================================ */
const { useState: suS, useEffect: suE, useRef: suR } = React;

/* role map for the four detectors */
const ROLES = {
  ce: { role: 'prosecutor', icon: 'glass', short: 'CROSS-EXAMINER', persona: 'THE PROSECUTION' },
  ca: { role: 'juror', icon: 'layers', short: 'CONSISTENCY', persona: 'THE ARCHIVIST' },
  ev: { role: 'juror', icon: 'doc', short: 'EVIDENCE', persona: 'THE INVESTIGATOR' },
  ba: { role: 'juror', icon: 'pulse', short: 'BEHAVIOR', persona: 'THE PROFILER' },
};
const metaOf = (k) => DETECTORS.find(d => d.key === k);

function clipFor(s) { return `inset(0 ${100 - s * 100}% 0 0)`; }
function susColor(s) { return s < 0.30 ? 'var(--green)' : s < 0.60 ? 'var(--yellow)' : s < 0.85 ? 'var(--orange)' : 'var(--red)'; }

/* ---- speech bubble ---- */
function Bubble({ kind, who, text, live, style, tail = 'b-down' }) {
  return (
    <div className={'bubble ' + kind + ' ' + tail} style={style}>
      <span className="who">{who}</span>
      {text}{live && <span className="caret">|</span>}
      <span className="tail"></span>
    </div>
  );
}

/* ---- detector mutter bubble ---- */
function Mutter({ accent, text, flag, style, tail }) {
  const bg = flag ? '#ffd5dd' : '#eef3ff';
  return (
    <div className={'mutter' + (flag ? ' flag' : '')} style={{ background: bg, ...style }}>
      {text}
      <span className="mtail" style={{ background: bg, ...(tail || {}) }}></span>
    </div>
  );
}

/* ---- nameplate ---- */
function Nameplate({ accent, k }) {
  const r = ROLES[k];
  return (
    <div className="nameplate" style={{ borderColor: '#000' }}>
      <div className="nm" style={{ color: accent }}>{r.short}</div>
      <div className="pn" style={{ color: 'var(--dim)' }}>{r.persona}</div>
    </div>
  );
}

/* ---- suspicion mini-meter ---- */
function SusMeter({ s, status }) {
  return (
    <div className="susmeter">
      <div className="sl"><span>SUSPICION</span><span style={{ color: s >= 0.85 ? 'var(--red)' : 'var(--text)' }}>{Math.round(s * 100)}%</span></div>
      <div className="sustrack"><div className="susfill" style={{ clipPath: clipFor(s), background: susColor(s) }}></div></div>
    </div>
  );
}

/* ---- JUDGE BENCH ---- */
function JudgeBench({ expr, speaking, banged, banner }) {
  return (
    <div className="zone bench">
      <div className="judge-seat">
        <div className="judge-char"><Character accent="#00FF88" role="judge" expr={expr} speaking={speaking} scale={1.18} /></div>
        <Gavel banged={banged} />
        <div className={'bang-fx' + (banged ? ' fire' : '')}>BANG!</div>
      </div>
      <div className="desk">
        <div className="nameplate"><div className="nm" style={{ color: '#00FF88' }}>THE ADJUDICATOR</div><div className="pn" style={{ color: 'var(--dim)' }}>PRESIDING</div></div>
      </div>
      {banner && <div className={'banner show ' + (banner.label === 'honest' ? 'hon' : 'dec')}>
        {banner.head} — {Math.round(banner.conf * 100)}%
        <span className="sub">{banner.decisive ? 'DECIDED BY ' + ROLES[banner.decisive].short : 'BY PANEL CONSENSUS'}</span>
      </div>}
    </div>
  );
}

/* ---- WITNESS STAND ---- */
function WitnessStand({ topic, expr, speaking, hot }) {
  return (
    <div className={'witness-zone' + (hot ? ' hot' : '')}>
      <div className="hot-aura"></div>
      <div className="stand-char"><Character accent="#00CFFF" role="witness" expr={expr} speaking={speaking} sweat={expr === 'sus' || expr === 'alarm'} scale={1.4} /></div>
      <div className="stand-box">
        <div className="rail"></div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 14, display: 'grid', placeItems: 'center', gap: 6 }}>
          <div className="nameplate"><div className="nm" style={{ color: '#00CFFF' }}>THE WITNESS</div><div className="pn" style={{ color: 'var(--dim)' }}>AGENT ON THE STAND</div></div>
          <div style={{ fontFamily: 'Space Mono, monospace', fontSize: 9, color: 'var(--dim)', maxWidth: 320, textAlign: 'center', letterSpacing: '.5px' }}>RE: {topic}</div>
        </div>
      </div>
    </div>
  );
}

/* ---- PROSECUTOR PODIUM (Cross-Examiner) ---- */
function Podium({ st, decisive }) {
  const meta = metaOf('ce');
  return (
    <div className={'zone podium-zone' + (decisive ? ' decisive' : '')}>
      <div className="spotlight"></div>
      <div className="ribbon">★ DECISIVE</div>
      <div className="podium-char"><Character accent={meta.hex} role="prosecutor" expr={exprFromSus(st.s)} speaking={st.speaking} scale={1.18} /></div>
      <div className="lectern">
        <div style={{ display: 'grid', placeItems: 'center', gap: 5 }}>
          <div className="susbadge"><MiniIcon kind="glass" /><span style={{ color: st.s >= 0.85 ? 'var(--red)' : 'var(--text)' }}>{Math.round(st.s * 100)}%</span><span className={'statuschip ' + (st.status || '')}>{(st.status || 'standby').toUpperCase()}</span></div>
          <div className="nameplate"><div className="nm" style={{ color: meta.hex }}>CROSS-EXAMINER</div><div className="pn" style={{ color: 'var(--dim)' }}>THE PROSECUTION</div></div>
        </div>
      </div>
    </div>
  );
}

/* ---- JURY BOX (3 jurors) ---- */
function JuryBox({ dets, decisive }) {
  const jurors = ['ca', 'ev', 'ba'];
  return (
    <div className="zone jury-zone">
      <div className="jury-cap">— THE JURY —</div>
      <div className="jury-row">
        {jurors.map(k => {
          const meta = metaOf(k); const st = dets[k];
          return (
            <div className={'juror' + (decisive === k ? ' decisive' : '')} key={k}>
              <div className="spotlight"></div>
              <div className="ribbon">★ DECISIVE</div>
              <div className="jchar"><Character accent={meta.hex} role="juror" expr={exprFromSus(st.s)} speaking={false} scale={1.0} /></div>
              <div className="jbench">
                <Nameplate accent={meta.hex} k={k} />
                <SusMeter s={st.s} status={st.status} />
                <div className={'statuschip ' + (st.status || '')} style={{ marginTop: 5 }}>{(st.status || 'standby').toUpperCase()}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- INFO PLACARD (top-right) ---- */
function InfoPlacard({ phaseIdx, progress, banner, clock, roundNo, roundTotal, revealed, mode }) {
  const ranges = { 0: [0, 5], 1: [5, 75], 2: [75, 95], 3: [95, 100] };
  return (
    <div className="zone info-zone">
      <div className="info-card">
        <div className="info-top"><span className="clock">{clock}</span><span className="rd">CASE {roundNo} / {roundTotal}</span></div>
        <div className="phase-row">
          {PHASES.map((p, i) => {
            const [a, b] = ranges[i]; const f = Math.max(0, Math.min(1, (progress - a) / (b - a)));
            return <div key={p} className={'pseg' + (i < phaseIdx ? ' done' : '') + (i === phaseIdx ? ' active' : '')}>
              <div className="pf" style={{ width: i === phaseIdx ? f * 100 + '%' : (i < phaseIdx ? '100%' : '0%') }}></div>
              <div className="pl">{p.slice(0, 4)}</div>
            </div>;
          })}
        </div>
        <div className="phase-name">{banner || PHASES[phaseIdx] + '…'}</div>
        <div className="mode-plac">
          {revealed
            ? <div className={'mp-face mp-back ' + mode}>{MODE_LABEL[mode]}</div>
            : <div className="mp-face mp-front"><span>???</span></div>}
        </div>
      </div>
    </div>
  );
}

/* ---- CONTROL RAIL ---- */
function Rail({ lastLine, onAsk, askable, onReplay, onMenu, onCaseFile, showCase }) {
  const [q, setQ] = suS('');
  const submit = () => { if (q.trim()) { onAsk(q.trim()); setQ(''); } };
  return (
    <div className="rail">
      <div className="record">
        <div className="rl">COURT RECORD</div>
        <div className="rt">{lastLine || '— awaiting testimony —'}</div>
      </div>
      <div className="hitl">
        <input value={q} disabled={!askable} placeholder={askable ? 'Object! Ask the witness a question…' : 'Floor opens during the examination'} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
        <button className="btn blue" disabled={!askable} onClick={submit}>OBJECT</button>
        {showCase && <button className="btn yellow" onClick={onCaseFile}>CASE FILE</button>}
        <button className="btn ghost" onClick={onMenu}>CASES</button>
        <button className="btn green" onClick={onReplay}>REPLAY</button>
      </div>
    </div>
  );
}

/* ---- START OVERLAY ---- */
function Overlay({ selIdx, setSelIdx, onStart }) {
  const r = ROUNDS[selIdx];
  return (
    <div className="overlay">
      <div className="ov-card">
        <div className="big">TELL</div>
        <div className="tag">THE PEOPLE v. THE AGENT</div>
        <div className="gavel-emoji">⚖️</div>
        <div className="desc">A panel of detector agents puts an AI witness on the stand. The prosecutor cross-examines, the jury weighs every word, and the scales of justice tip in real time — until the Adjudicator brings down the gavel and the truth is revealed.</div>
        <button className="start-btn" onClick={onStart}>⚖ CALL THE COURT TO ORDER</button>
        <div className="picker">
          {ROUNDS.map((rd, i) => (
            <div key={rd.id} className={'pick' + (i === selIdx ? ' sel' : '')} onClick={() => setSelIdx(i)}>
              <span className="pn">CASE 0{i + 1}</span>{rd.topic}
            </div>
          ))}
        </div>
        <div className="blurb">{r.blurb}</div>
      </div>
    </div>
  );
}

/* ---- CASE FILE ---- */
function CaseFile({ round, dets, verdict, decisive, onClose, onNext }) {
  if (!verdict) return null;
  const truthDeceptive = round.mode !== 'honest';
  const correct = truthDeceptive === (verdict.label !== 'honest');
  const ranked = DETECTORS.map(d => ({ ...d, s: dets[d.key].s })).sort((a, b) => b.s - a.s);
  const best = ranked[0];
  const single = truthDeceptive ? best.s >= 0.85 : best.s < 0.5;
  const confPct = Math.round(verdict.conf * 100);
  const px = 20 + verdict.conf * 240, py = 130 - (correct ? 1 : 0) * 110;
  return (
    <div className="casefile open">
      <button className="btn ghost cf-close" onClick={onClose}>CLOSE ✕</button>
      <div className="cf-inner">
        <div className="cf-col">
          <h3>THE CASE FILE</h3>
          <div className={'cf-badge ' + (correct ? 'ok' : 'miss')}>{correct ? '✓ JUSTICE SERVED' : '✕ MISTRIAL'}</div>
          <div className="cf-row"><span>Charge</span><b>{round.topic}</b></div>
          <div className="cf-row"><span>Ground truth</span><b>{MODE_LABEL[round.mode].replace('\n', ' ')}</b></div>
          <div className="cf-row"><span>Verdict</span><b>{verdict.head} {confPct}%</b></div>
          <div className="cf-row"><span>Decided by</span><b>{decisive ? ROLES[decisive].short : 'Consensus'}</b></div>
          <div className="cf-note"><b style={{ color: '#fff' }}>The secret:</b> {round.secret}</div>
        </div>
        <div className="cf-col">
          <h3>THE PANEL'S RECORD</h3>
          {ranked.map(d => (
            <div className="cf-bar" key={d.key}>
              <div className="cf-bl"><span>{ROLES[d.key].short}{decisive === d.key ? ' ★' : ''}</span><span>{Math.round(d.s * 100)}%</span></div>
              <div className="cf-track"><div className="cf-fill" style={{ width: d.s * 100 + '%', background: susColor(d.s) }}></div></div>
            </div>
          ))}
          <div className="cf-note">Best lone detector ({ROLES[best.key].short}) would have {single ? <b style={{ color: '#00FF88' }}>caught it ✓</b> : <b style={{ color: '#FF2D55' }}>missed it ✕</b>}. The jury wins by covering each method's blind spot.</div>
        </div>
        <div className="cf-col">
          <h3>CALIBRATION</h3>
          <svg className="cf-plot" viewBox="0 0 280 150">
            <line x1="20" y1="130" x2="20" y2="14" stroke="#2a3247" strokeWidth="1.5" />
            <line x1="20" y1="130" x2="270" y2="130" stroke="#2a3247" strokeWidth="1.5" />
            <line x1="20" y1="130" x2="260" y2="20" stroke="#55617a" strokeWidth="1.5" strokeDasharray="4 4" />
            {[{ x: 0.62, y: 1 }, { x: 0.74, y: 1 }, { x: 0.81, y: 1 }, { x: 0.55, y: 0 }, { x: 0.9, y: 1 }].map((p, i) => <circle key={i} cx={20 + p.x * 240} cy={130 - p.y * 110} r="3.5" fill="#8899AA" />)}
            <circle cx={px} cy={py} r="6" fill={correct ? '#00FF88' : '#FF2D55'} stroke="#000" strokeWidth="2" />
          </svg>
          <div className="cf-row" style={{ marginTop: 10 }}><span>Brier score</span><b>0.11</b></div>
          <div className="cf-row"><span>Accuracy / 40 rounds</span><b>90%</b></div>
          <div className="cf-row"><span>False-positive rate</span><b>7%</b></div>
          <button className="btn green" style={{ marginTop: 16, width: '100%', fontSize: 22 }} onClick={onNext}>NEXT CASE →</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Bubble, Mutter, JudgeBench, WitnessStand, Podium, JuryBox, InfoPlacard, Rail, Overlay, CaseFile, ROLES, metaOf, susColor, clipFor });
