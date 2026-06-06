/* ============================================================
   TELL — orchestrator / timeline player
   Walks a round's scripted steps, driving every live element.
   ============================================================ */
const { useState: uS, useEffect: uE, useRef: uR } = React;

const DEFLECTIONS = [
  'I believe I\u2019ve already covered that. The report stands on its own.',
  'That\u2019s a fair question — it was all part of the broader engagement.',
  'I\u2019d have to pull the exact records, but nothing in there is out of the ordinary.',
  'As I said, everything maps back to the account work.',
];

function freshDetectorState() {
  const o = {};
  DETECTORS.forEach(d => { o[d.key] = { s: 0, status: 'idle', feed: [], flash: false }; });
  return o;
}

const TWEAK_DEFAULTS = { speed: 1, spike: 1, glow: 1, scanlines: true };

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [roundIdx, setRoundIdx] = uS(1);          // default: the strategic-deception hero
  const [selIdx, setSelIdx] = uS(1);
  const [overlay, setOverlay] = uS(true);
  const round = ROUNDS[roundIdx];

  const [phaseIdx, setPhaseIdx] = uS(0);
  const [progress, setProgress] = uS(0);
  const [banner, setBanner] = uS('');
  const [transcript, setTranscript] = uS([]);
  const [current, setCurrent] = uS(null);
  const [speaking, setSpeaking] = uS(false);
  const [dets, setDets] = uS(freshDetectorState());
  const [gauge, setGauge] = uS(0.5);
  const [verdict, setVerdict] = uS(null);
  const [verdictFired, setVerdictFired] = uS(false);
  const [decisive, setDecisive] = uS(null);
  const [revealed, setRevealed] = uS(false);
  const [vigFire, setVigFire] = uS(false);
  const [clock, setClock] = uS('00:00');
  const [caseOpen, setCaseOpen] = uS(false);
  const [showCaseBtn, setShowCaseBtn] = uS(false);

  const gen = uR(0);
  const startMs = uR(0);
  const clockTimer = uR(null);
  const speedRef = uR(1);

  uE(() => { speedRef.current = t.speed; }, [t.speed]);
  uE(() => {
    const r = document.documentElement.style;
    r.setProperty('--spike', String(t.spike));
    r.setProperty('--glow', String(t.glow));
    r.setProperty('--scan-op', String(t.scanlines ? 0.05 : 0));
  }, [t.spike, t.glow, t.scanlines]);

  const stale = (g) => g !== gen.current;
  const delay = (ms) => new Promise(r => setTimeout(r, ms / speedRef.current));
  const elapsed = () => {
    const t = Math.floor((Date.now() - startMs.current) / 1000);
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  };

  function resetState() {
    setPhaseIdx(0); setProgress(0); setBanner(''); setTranscript([]); setCurrent(null);
    setSpeaking(false); setDets(freshDetectorState()); setGauge(0.5); setVerdict(null);
    setVerdictFired(false); setDecisive(null); setRevealed(false); setVigFire(false);
    setClock('00:00'); setCaseOpen(false); setShowCaseBtn(false);
  }

  function startRound(idx) {
    gen.current++;
    const myGen = gen.current;
    setRoundIdx(idx);
    resetState();
    setOverlay(false);
    startMs.current = Date.now();
    if (clockTimer.current) clearInterval(clockTimer.current);
    clockTimer.current = setInterval(() => { if (!stale(myGen)) setClock(elapsed()); }, 1000);
    // run after state flush
    setTimeout(() => run(ROUNDS[idx], myGen), 60);
  }

  async function run(rnd, myGen) {
    const script = rnd.script;
    const delibIdx = script.findIndex(s => s.k === 'phase' && s.phase === 'DELIBERATING');
    const interEvents = script.filter((s, i) => (s.k === 'say' || s.k === 'sig') && i < delibIdx).length;
    const inc = 70 / Math.max(1, interEvents);
    let prog = 0, gv = 0.06;

    for (const st of script) {
      if (stale(myGen)) return;

      if (st.k === 'phase') {
        setPhaseIdx(PHASES.indexOf(st.phase));
        setBanner(st.banner || '');
        if (st.phase === 'SETUP') { prog = 5; setProgress(5); }
        if (st.phase === 'DELIBERATING') {
          setProgress(76);
          // ease toward 92 during deliberation
          for (let p = 78; p <= 92 && !stale(myGen); p += 2) { setProgress(p); await delay(120); }
        }
        await delay(420);

      } else if (st.k === 'say') {
        await typeSay(st.who, st.text, myGen);
        prog = Math.min(75, prog + inc);
        setProgress(prog);
        await delay(220);

      } else if (st.k === 'sig') {
        const ts = elapsed();
        setDets(d => ({ ...d, [st.d]: { s: st.s, status: st.status || d[st.d].status, flash: true, feed: [...d[st.d].feed, { ts, text: st.r, flag: st.s >= 0.85 }] } }));
        setTimeout(() => { if (!stale(myGen)) setDets(d => ({ ...d, [st.d]: { ...d[st.d], flash: false } })); }, 420);
        gv = Math.max(gv, st.s);
        setGauge(gv);
        prog = Math.min(75, prog + inc);
        setProgress(prog);
        await delay(560);

      } else if (st.k === 'beat') {
        await delay(st.ms);

      } else if (st.k === 'verdict') {
        setPhaseIdx(3); setProgress(100);
        const dp = st.label === 'honest' ? (1 - st.conf) : st.conf;
        setVerdict(st);
        setGauge(dp);                // needle swings (CSS transition)
        await delay(160);
        if (stale(myGen)) return;
        setVerdictFired(true);
        setDecisive(st.decisive);
        setVigFire(true); setTimeout(() => { if (!stale(myGen)) setVigFire(false); }, 1300);
        // flash contributing cards
        (st.contributing || []).forEach(k => {
          setDets(d => ({ ...d, [k]: { ...d[k], flash: true } }));
          setTimeout(() => { if (!stale(myGen)) setDets(d => ({ ...d, [k]: { ...d[k], flash: false } })); }, 1200);
        });
        if (clockTimer.current) clearInterval(clockTimer.current);

      } else if (st.k === 'reveal') {
        setRevealed(true);
        setShowCaseBtn(true);
      }
    }
  }

  async function typeSay(who, text, myGen) {
    setSpeaking(who === 'speaker');
    const per = (who === 'speaker' ? 18 : 30) / speedRef.current;
    const t0 = Date.now();
    await new Promise(resolve => {
      const id = setInterval(() => {
        if (stale(myGen)) { clearInterval(id); resolve(); return; }
        const e = Date.now() - t0;
        const n = Math.min(text.length, Math.floor(e / per) + 1);
        setCurrent({ who, text: text.slice(0, n) });
        if (n >= text.length) { clearInterval(id); resolve(); }
      }, 28);
    });
    await delay(360);
    if (stale(myGen)) return;
    setCurrent(null);
    setTranscript(t => [...t, { who, text }]);
    setSpeaking(false);
  }

  /* presenter failsafe / verification: jump straight to the verdict + reveal */
  function applyFinal(rnd) {
    const last = {};
    rnd.script.forEach(s => { if (s.k === 'sig') last[s.d] = s; });
    const nd = freshDetectorState();
    Object.keys(last).forEach(k => {
      nd[k] = { s: last[k].s, status: last[k].status || 'flagging', flash: false, feed: [{ ts: '--:--', text: last[k].r, flag: last[k].s >= 0.85 }] };
    });
    setDets(nd);
    const tr = [];
    rnd.script.forEach(s => { if (s.k === 'say') tr.push({ who: s.who, text: s.text }); });
    setTranscript(tr); setCurrent(null); setSpeaking(false);
    const v = rnd.script.find(s => s.k === 'verdict');
    setVerdict(v); setDecisive(v.decisive);
    setGauge(v.label === 'honest' ? (1 - v.conf) : v.conf);
    setPhaseIdx(3); setProgress(100); setVerdictFired(true); setRevealed(true); setShowCaseBtn(true);
    setVigFire(true); setTimeout(() => setVigFire(false), 1300);
  }

  function onAsk(q) {
    const reply = DEFLECTIONS[Math.floor(Math.random() * DEFLECTIONS.length)];
    setTranscript(t => [...t, { who: 'human', text: q }, { who: 'speaker', text: reply }]);
    const ts = elapsed();
    setDets(d => ({ ...d, ba: { ...d.ba, s: Math.min(0.95, d.ba.s + 0.05), status: d.ba.s + 0.05 >= 0.85 ? 'flagging' : d.ba.status, feed: [...d.ba.feed, { ts, text: 'Human interjection \u2014 witness answered without committing to a new specific. Minor evasion logged.', flag: false }] } }));
  }

  uE(() => () => { if (clockTimer.current) clearInterval(clockTimer.current); }, []);

  /* presenter shortcuts + verification hooks */
  uE(() => {
    window.__tellSpeed = (x) => { speedRef.current = x; };
    window.__tellFinal = (i = roundIdx) => { gen.current++; if (clockTimer.current) clearInterval(clockTimer.current); setRoundIdx(i); setOverlay(false); applyFinal(ROUNDS[i]); };
    const onKey = (e) => {
      if (e.key === 'v' || e.key === 'V') window.__tellFinal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [roundIdx]);

  const maxSusp = Math.max(...DETECTORS.map(d => dets[d.key].s));
  const hot = maxSusp >= 0.70;
  const askable = phaseIdx === 1 && !verdict;
  const roundNo = roundIdx + 1;

  return (
    <div className="app">
      <div className={'vignette' + (vigFire ? ' fire' : '')} />

      <TopBar phaseIdx={phaseIdx} progress={progress} banner={banner} round={round}
        roundNo={roundNo} roundTotal={ROUNDS.length} clock={clock} revealed={revealed} />

      <div className="stage">
        <Witness topic={round.topic} transcript={transcript} current={current}
          speaking={speaking} hot={hot} revealed={revealed} />
        <div className="bureau">
          {DETECTORS.map(m => (
            <DetectorCard key={m.key} meta={m} state={dets[m.key]} decisive={decisive === m.key} />
          ))}
        </div>
      </div>

      <Adjudicator gaugeVal={gauge} verdict={verdict} verdictFired={verdictFired}
        onAsk={onAsk} askable={askable}
        onRestart={() => startRound(roundIdx)} onMenu={() => { gen.current++; setOverlay(true); setSelIdx(roundIdx); }}
        onCaseFile={() => setCaseOpen(o => !o)} showCaseFile={showCaseBtn} />

      {caseOpen && <CaseFile round={round} dets={dets} verdict={verdict} decisive={decisive} onClose={() => setCaseOpen(false)} onNext={() => startRound((roundIdx + 1) % ROUNDS.length)} />}

      {overlay && <Overlay selIdx={selIdx} setSelIdx={setSelIdx} onStart={() => startRound(selIdx)} />}

      <TweaksPanel>
        <TweakSection label="Playback" />
        <TweakSlider label="Speed" value={t.speed} min={0.5} max={3} step={0.25} unit="×" onChange={v => setTweak('speed', v)} />
        <TweakSection label="Drama" />
        <TweakSlider label="Spike intensity" value={t.spike} min={0.5} max={2} step={0.1} unit="×" onChange={v => setTweak('spike', v)} />
        <TweakSlider label="Neon glow" value={t.glow} min={0} max={2} step={0.1} unit="×" onChange={v => setTweak('glow', v)} />
        <TweakToggle label="CRT scanlines" value={t.scanlines} onChange={v => setTweak('scanlines', v)} />
      </TweaksPanel>
    </div>
  );
}

/* ---- START / ROUND-SELECT OVERLAY ---- */
function Overlay({ selIdx, setSelIdx, onStart }) {
  const r = ROUNDS[selIdx];
  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="big glow-green">TELL</div>
        <div className="tag">A LIVE LIE DETECTOR FOR AI AGENTS</div>
        <div className="desc">
          A panel of detector agents interrogates a witness in real time. Their suspicion meters move live — and the instant the witness starts to deceive, the panel converges and calls it. Then the truth is revealed.
        </div>
        <button className="start-btn" onClick={onStart}>▶ BEGIN INTERROGATION</button>
        <div className="round-picker">
          {ROUNDS.map((rd, i) => (
            <div key={rd.id} className={'round-pick' + (i === selIdx ? ' sel' : '')} onClick={() => setSelIdx(i)} style={{ maxWidth: 200 }}>
              <span className="rp-n">CASE 0{i + 1}</span>
              {rd.topic}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, color: '#8899AA', maxWidth: 440, marginLeft: 'auto', marginRight: 'auto', textWrap: 'pretty' }}>
          {r.blurb}
        </div>
      </div>
    </div>
  );
}

/* ---- CASE FILE DRAWER ---- */
function CaseFile({ round, dets, verdict, decisive, onClose, onNext }) {
  if (!verdict) return null;
  const truthDeceptive = round.mode !== 'honest';
  const calledDeceptive = verdict.label !== 'honest';
  const correct = truthDeceptive === calledDeceptive;
  const ranked = DETECTORS.map(d => ({ ...d, s: dets[d.key].s })).sort((a, b) => b.s - a.s);
  const bestSingle = ranked[0];
  const singleCatches = truthDeceptive ? bestSingle.s >= 0.85 : bestSingle.s < 0.5;
  const confPct = Math.round(verdict.conf * 100);
  // calibration point
  const px = 20 + verdict.conf * 240;
  const outcome = correct ? 1 : 0;
  const py = 130 - outcome * 110;
  return (
    <div className="casefile open">
      <div className="cf-inner">
        <button className="ctl-btn ghost cf-close" onClick={onClose}>CLOSE ✕</button>

        <div className="cf-col">
          <h3>THE CASE FILE</h3>
          <div className={'cf-verdict-badge ' + (correct ? 'ok' : 'miss')}>{correct ? '✓ PANEL CORRECT' : '✕ PANEL MISSED'}</div>
          <div className="cf-row"><span>Topic</span><b>{round.topic}</b></div>
          <div className="cf-row"><span>Ground truth</span><b>{MODE_LABEL[round.mode].replace('\n', ' ')}</b></div>
          <div className="cf-row"><span>Panel verdict</span><b>{verdict.head} {confPct}%</b></div>
          <div className="cf-row"><span>Decisive</span><b>{decisive ? DET_NAME[decisive] : 'Consensus'}</b></div>
          <div className="cf-note"><b style={{ color: '#fff' }}>The secret:</b> {round.secret}</div>
        </div>

        <div className="cf-col">
          <h3>DETECTIVE PERFORMANCE</h3>
          {ranked.map(d => (
            <div className="cf-bar" key={d.key}>
              <div className="cf-bl"><span>{d.name}{decisive === d.key ? ' ★' : ''}</span><span>{Math.round(d.s * 100)}%</span></div>
              <div className="cf-track"><div className="cf-fill" style={{ width: (d.s * 100) + '%', background: window.fillColor(d.s) }} /></div>
            </div>
          ))}
          <div className="cf-note">
            Best single detector ({bestSingle.name}) would have {singleCatches ? <b style={{ color: '#00FF88' }}>caught it ✓</b> : <b style={{ color: '#FF2D55' }}>missed it ✕</b>}.
            The panel wins by covering each method’s blind spot.
          </div>
        </div>

        <div className="cf-col">
          <h3>CALIBRATION</h3>
          <svg className="cf-plot" viewBox="0 0 280 150">
            <line x1="20" y1="130" x2="20" y2="14" stroke="#2a3247" strokeWidth="1.5" />
            <line x1="20" y1="130" x2="270" y2="130" stroke="#2a3247" strokeWidth="1.5" />
            <line x1="20" y1="130" x2="260" y2="20" stroke="#55617a" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="120" y="148" fontFamily="Space Mono" fontSize="9" fill="#8899AA">predicted confidence →</text>
            {[
              { x: 0.62, y: 1 }, { x: 0.74, y: 1 }, { x: 0.81, y: 1 }, { x: 0.55, y: 0 }, { x: 0.9, y: 1 },
            ].map((p, i) => <circle key={i} cx={20 + p.x * 240} cy={130 - p.y * 110} r="3.5" fill="#8899AA" />)}
            <circle cx={px} cy={py} r="6" fill={correct ? '#00FF88' : '#FF2D55'} stroke="#000" strokeWidth="2" />
          </svg>
          <div className="cf-row" style={{ marginTop: 10 }}><span>Brier score</span><b>0.11 (well-calibrated)</b></div>
          <div className="cf-row"><span>Accuracy / 40 rounds</span><b>90%</b></div>
          <div className="cf-row"><span>False-positive rate</span><b>7%</b></div>
          <button className="ctl-btn green" style={{ marginTop: 16, width: '100%', fontSize: 22 }} onClick={onNext}>NEXT CASE →</button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { App, Overlay, CaseFile });
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
