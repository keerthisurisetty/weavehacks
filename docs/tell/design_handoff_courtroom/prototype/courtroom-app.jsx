/* ============================================================
   TELL Courtroom — orchestrator (mounts the app)
   Reuses ROUNDS / DETECTORS / PHASES / MODE_LABEL from rounds.jsx
   ============================================================ */
const { useState: aS, useEffect: aE, useRef: aR } = React;

const DEFLECTIONS = [
  'I believe I\u2019ve already covered that. The report speaks for itself.',
  'That\u2019s a fair question \u2014 it was all part of the broader engagement.',
  'I\u2019d have to pull the exact records, but nothing there is out of the ordinary.',
  'As I\u2019ve said, everything maps back to the account work.',
];

function freshDets() { const o = {}; DETECTORS.forEach(d => { o[d.key] = { s: 0, status: 'idle' }; }); return o; }
function freshMutters() { return { ce: null, ca: null, ev: null, ba: null }; }

/* bubble anchor positions within the 1600x940 stage */
const JCX = [1103, 1263, 1423];   // jury column centers
const ANCH = {
  witness: { left: 95, top: 250, maxWidth: 430, tail: 'b-down' },
  ask:     { left: 545, top: 392, maxWidth: 440, tail: 'b-down' },
  mut_ce:  { left: 392, top: 556, maxWidth: 212, tail: 'b-left' },
};

function CourtApp() {
  const [roundIdx, setRoundIdx] = aS(1);
  const [selIdx, setSelIdx] = aS(1);
  const [overlay, setOverlay] = aS(true);
  const round = ROUNDS[roundIdx];

  const [phaseIdx, setPhaseIdx] = aS(0);
  const [progress, setProgress] = aS(0);
  const [banner, setBanner] = aS('');
  const [clock, setClock] = aS('00:00');

  const [witnessSay, setWitnessSay] = aS(null);
  const [witnessSpeaking, setWitnessSpeaking] = aS(false);
  const [ask, setAsk] = aS(null);
  const [ceSpeaking, setCeSpeaking] = aS(false);

  const [dets, setDets] = aS(freshDets());
  const [mutters, setMutters] = aS(freshMutters());
  const [gaugeP, setGaugeP] = aS(0.06);

  const [verdict, setVerdict] = aS(null);
  const [verdictBanner, setVerdictBanner] = aS(null);
  const [decisive, setDecisive] = aS(null);
  const [revealed, setRevealed] = aS(false);
  const [banged, setBanged] = aS(false);
  const [flash, setFlash] = aS(null);     // 'dec' | 'hon'
  const [lastLine, setLastLine] = aS('');
  const [caseOpen, setCaseOpen] = aS(false);
  const [showCaseBtn, setShowCaseBtn] = aS(false);
  const [scale, setScale] = aS(1);

  const gen = aR(0); const startMs = aR(0); const clockT = aR(null);
  const stale = (g) => g !== gen.current;
  const delay = (ms) => new Promise(r => setTimeout(r, ms));
  const elapsed = () => { const t = Math.floor((Date.now() - startMs.current) / 1000); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };

  /* responsive stage scaling */
  aE(() => {
    const fit = () => {
      const w = window.innerWidth || document.documentElement.clientWidth || 1440;
      const h = window.innerHeight || document.documentElement.clientHeight || 900;
      const s = Math.min(w / 1600, h / 940);
      if (s > 0) setScale(s);
    };
    fit();
    requestAnimationFrame(fit);
    const t1 = setTimeout(fit, 120);
    const t2 = setTimeout(fit, 400);
    window.addEventListener('resize', fit);
    return () => { window.removeEventListener('resize', fit); clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function reset() {
    setPhaseIdx(0); setProgress(0); setBanner(''); setClock('00:00');
    setWitnessSay(null); setWitnessSpeaking(false); setAsk(null); setCeSpeaking(false);
    setDets(freshDets()); setMutters(freshMutters()); setGaugeP(0.06);
    setVerdict(null); setVerdictBanner(null); setDecisive(null); setRevealed(false);
    setBanged(false); setFlash(null); setLastLine(''); setCaseOpen(false); setShowCaseBtn(false);
  }

  function startRound(idx) {
    gen.current++; const myGen = gen.current;
    setRoundIdx(idx); reset(); setOverlay(false);
    startMs.current = Date.now();
    if (clockT.current) clearInterval(clockT.current);
    clockT.current = setInterval(() => { if (!stale(myGen)) setClock(elapsed()); }, 1000);
    setTimeout(() => run(ROUNDS[idx], myGen), 60);
  }

  async function run(rnd, myGen) {
    const script = rnd.script;
    const delibIdx = script.findIndex(s => s.k === 'phase' && s.phase === 'DELIBERATING');
    const evts = script.filter((s, i) => (s.k === 'say' || s.k === 'sig') && i < delibIdx).length;
    const inc = 70 / Math.max(1, evts);
    let prog = 0, gv = 0.06;

    for (const st of script) {
      if (stale(myGen)) return;
      if (st.k === 'phase') {
        setPhaseIdx(PHASES.indexOf(st.phase)); setBanner(st.banner || '');
        if (st.phase === 'SETUP') { prog = 5; setProgress(5); }
        if (st.phase === 'DELIBERATING') { setProgress(76); for (let p = 78; p <= 92 && !stale(myGen); p += 2) { setProgress(p); await delay(120); } }
        await delay(420);
      } else if (st.k === 'say') {
        await typeSay(st.who, st.text, myGen);
        prog = Math.min(75, prog + inc); setProgress(prog); await delay(200);
      } else if (st.k === 'sig') {
        const ts = elapsed();
        setDets(d => ({ ...d, [st.d]: { s: st.s, status: st.status || d[st.d].status } }));
        setMutters(m => ({ ...m, [st.d]: { text: st.r, flag: st.s >= 0.85, ts } }));
        gv = Math.max(gv, st.s); setGaugeP(gv);
        prog = Math.min(75, prog + inc); setProgress(prog);
        await delay(640);
      } else if (st.k === 'beat') {
        await delay(st.ms);
      } else if (st.k === 'verdict') {
        setPhaseIdx(3); setProgress(100);
        const dp = st.label === 'honest' ? (1 - st.conf) : st.conf;
        setVerdict(st); setGaugeP(dp); setDecisive(st.decisive);
        await delay(160); if (stale(myGen)) return;
        setBanged(true); setVerdictBanner(st);
        setFlash(st.label === 'honest' ? 'hon' : 'dec');
        setLastLine('THE PANEL RULES: ' + st.head + ' (' + Math.round(st.conf * 100) + '%)');
        setTimeout(() => { if (!stale(myGen)) setFlash(null); }, 1300);
        if (clockT.current) clearInterval(clockT.current);
      } else if (st.k === 'reveal') {
        setRevealed(true); setShowCaseBtn(true);
      }
    }
  }

  async function typeSay(who, text, myGen) {
    const setter = who === 'speaker' ? setWitnessSay : setAsk;
    const wrap = who === 'speaker' ? (t) => ({ text: t }) : (t) => ({ who, text: t });
    if (who === 'speaker') setWitnessSpeaking(true); else if (who === 'ce') setCeSpeaking(true);
    setLastLine((who === 'speaker' ? 'WITNESS: ' : who === 'ce' ? 'EXAMINER: ' : '[YOU]: ') + '\u201c' + text + '\u201d');
    const per = (who === 'speaker' ? 17 : 27);
    const t0 = Date.now();
    await new Promise(res => {
      const id = setInterval(() => {
        if (stale(myGen)) { clearInterval(id); res(); return; }
        const n = Math.min(text.length, Math.floor((Date.now() - t0) / per) + 1);
        setter(wrap(text.slice(0, n)));
        if (n >= text.length) { clearInterval(id); res(); }
      }, 26);
    });
    await delay(360); if (stale(myGen)) return;
    if (who === 'speaker') setWitnessSpeaking(false); else if (who === 'ce') setCeSpeaking(false);
  }

  function onAsk(q) {
    const reply = DEFLECTIONS[Math.floor(Math.random() * DEFLECTIONS.length)];
    setAsk({ who: 'human', text: q });
    setLastLine('[YOU]: \u201c' + q + '\u201d');
    const ts = elapsed();
    setDets(d => { const ns = Math.min(0.95, d.ba.s + 0.05); return { ...d, ba: { s: ns, status: ns >= 0.85 ? 'flagging' : d.ba.status } }; });
    setMutters(m => ({ ...m, ba: { text: 'Witness fielded the interjection without committing to a new specific. Minor evasion logged.', flag: false, ts } }));
    setTimeout(() => setWitnessSay({ text: reply }), 700);
  }

  /* verification + presenter helpers */
  function applyFinal(rnd) {
    const last = {}; rnd.script.forEach(s => { if (s.k === 'sig') last[s.d] = s; });
    const nd = freshDets(); const nm = freshMutters();
    Object.keys(last).forEach(k => { nd[k] = { s: last[k].s, status: last[k].status || 'flagging' }; nm[k] = { text: last[k].r, flag: last[k].s >= 0.85, ts: '--:--' }; });
    setDets(nd); setMutters(nm);
    let lastSpk = null, lastAsk = null;
    rnd.script.forEach(s => { if (s.k === 'say') { if (s.who === 'speaker') lastSpk = s.text; else lastAsk = { who: s.who, text: s.text }; } });
    setWitnessSay(lastSpk ? { text: lastSpk } : null); setAsk(lastAsk);
    const v = rnd.script.find(s => s.k === 'verdict');
    setVerdict(v); setVerdictBanner(v); setDecisive(v.decisive); setGaugeP(v.label === 'honest' ? (1 - v.conf) : v.conf);
    setPhaseIdx(3); setProgress(100); setBanged(true); setRevealed(true); setShowCaseBtn(true);
    setFlash(v.label === 'honest' ? 'hon' : 'dec'); setTimeout(() => setFlash(null), 1300);
  }
  aE(() => {
    window.__courtFinal = (i = roundIdx) => { gen.current++; if (clockT.current) clearInterval(clockT.current); setRoundIdx(i); setOverlay(false); reset(); setTimeout(() => applyFinal(ROUNDS[i]), 40); };
    const onKey = (e) => { if (e.key === 'v' || e.key === 'V') window.__courtFinal(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [roundIdx]);
  aE(() => () => { if (clockT.current) clearInterval(clockT.current); }, []);

  const maxSus = Math.max(...DETECTORS.map(d => dets[d.key].s));
  const witnessExpr = exprFromSus(maxSus, true);
  const judgeExpr = verdict ? (verdict.label === 'honest' ? 'calm' : 'sus') : 'calm';
  const askable = phaseIdx === 1 && !verdict;

  return (
    <div className="scaler">
      <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
        <div className="pillars"></div>
        <div className="seal"><div className="ring">★ COURT OF<br />VERACITY ★</div></div>
        <div className="floor"></div>

        <div className="scales-zone">
          <div className="cap">SCALES OF JUSTICE</div>
          <Scales p={gaugeP} settled={!!verdict} />
          <div className="reading">{verdict ? 'VERDICT RENDERED' : 'WEIGHING TESTIMONY \u2014 ' + Math.round(gaugeP * 100) + '% SUSPECT'}</div>
        </div>

        <JudgeBench expr={judgeExpr} speaking={false} banged={banged} banner={verdictBanner} />

        <InfoPlacard phaseIdx={phaseIdx} progress={progress} banner={banner} clock={clock}
          roundNo={roundIdx + 1} roundTotal={ROUNDS.length} revealed={revealed} mode={round.mode} />

        <WitnessStand topic={round.topic} expr={witnessExpr} speaking={witnessSpeaking} hot={maxSus >= 0.7} />

        <Podium st={{ ...dets.ce, speaking: ceSpeaking }} decisive={decisive === 'ce'} />

        <JuryBox dets={dets} decisive={decisive} />

        {/* speech bubbles */}
        {witnessSay && <Bubble kind="witness" who="WITNESS" text={witnessSay.text} live={witnessSpeaking} tail={ANCH.witness.tail}
          style={{ left: ANCH.witness.left, top: ANCH.witness.top, maxWidth: ANCH.witness.maxWidth }} />}
        {ask && <Bubble kind={ask.who === 'human' ? 'human' : 'ce'} who={ask.who === 'human' ? 'YOU' : 'CROSS-EXAMINER'} text={ask.text} live={ceSpeaking}
          tail={ANCH.ask.tail} style={{ left: ANCH.ask.left, top: ANCH.ask.top, maxWidth: ANCH.ask.maxWidth }} />}

        {/* detector mutters */}
        {mutters.ce && <Mutter accent={metaOf('ce').hex} text={mutters.ce.text} flag={mutters.ce.flag}
          style={{ left: ANCH.mut_ce.left, top: ANCH.mut_ce.top, maxWidth: ANCH.mut_ce.maxWidth }} tail={{ right: -7, top: 24, transform: 'rotate(135deg)' }} />}
        {['ca', 'ev', 'ba'].map((k, i) => mutters[k] && (
          <Mutter key={k} accent={metaOf(k).hex} text={mutters[k].text} flag={mutters[k].flag}
            style={{ left: JCX[i], bottom: 556, maxWidth: 174, transform: 'translateX(-50%)' }}
            tail={{ bottom: -7, left: '50%', marginLeft: -7, transform: 'rotate(45deg)' }} />
        ))}

        <div className={'flash ' + (flash === 'hon' ? 'hon ' : '') + (flash ? 'fire' : '')}></div>

        <Rail lastLine={lastLine} onAsk={onAsk} askable={askable}
          onReplay={() => startRound(roundIdx)} onMenu={() => { gen.current++; setOverlay(true); setSelIdx(roundIdx); }}
          onCaseFile={() => setCaseOpen(o => !o)} showCase={showCaseBtn} />

        {caseOpen && <CaseFile round={round} dets={dets} verdict={verdict} decisive={decisive} onClose={() => setCaseOpen(false)} onNext={() => startRound((roundIdx + 1) % ROUNDS.length)} />}

        {overlay && <Overlay selIdx={selIdx} setSelIdx={setSelIdx} onStart={() => startRound(selIdx)} />}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<CourtApp />);
