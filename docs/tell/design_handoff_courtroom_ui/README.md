# Handoff: TELL — "The Interrogation Room" Courtroom UI

## Overview
**Tell** is a live, black-box, multi-agent lie detector for AI agents. A *speaker* agent is
interrogated in real time by a panel of *detector* agents; their suspicion meters move live, and the
instant the speaker starts to deceive the panel converges on a calibrated verdict
(*"DECEPTION — 87%"*), then the ground truth is revealed.

This handoff covers the **courtroom front-end** — the single full-screen view that visualizes a round
as it runs: the witness + streaming testimony, the four-detector "Detective Bureau," the adjudicator
verdict gauge, the human-in-the-loop question box, the post-round Case File, and the start/round-select
overlay. Aesthetic: **"Neon Noir Cartoon"** — hard black outlines, offset (non-blurred) drop shadows,
saturated neon glow, CRT scanlines.

---

## About the Design Files
The files in `prototype/` are a **design reference built in HTML/React-via-Babel** — a working prototype
that shows the intended look, motion, and behavior. **They are not production code to ship as-is.**

Your task is to **recreate this UI inside the real Tell frontend** (per the implementation plan that is
**Next.js + React + CopilotKit/AG-UI**, with a FastAPI WebSocket fallback), using that codebase's
established patterns (components, styling approach, state). The prototype drives itself from a **scripted
timeline**; in production you replace that timeline with the **live AG-UI shared-state / event stream**
(or the WebSocket fallback). The visual layer, component structure, animations, and design tokens should
be reproduced faithfully — only the data source changes.

The prototype's data model is a deliberate 1:1 mirror of the backend interfaces in `docs/SPEC.md §8`
(`DetectorSignal`, `Verdict`, `Round`), so the wiring is mechanical — see **State Management** below.

> Keep the prototype's scripted-timeline mode too if convenient: it's an excellent **deterministic demo
> failsafe** to run on stage alongside live mode (the prototype already exposes a presenter shortcut —
> pressing **`V`** jumps straight to the verdict).

---

## Fidelity
**High-fidelity.** Final colors, typography, spacing, shadows, and motion are specified below and present
in `prototype/styles.css`. Recreate pixel-faithfully. Target a laptop/monitor demo at **≥1280px wide**;
below ~1080px the layout stacks vertically (see Responsive).

---

## Tech mapping (prototype → production)
| Prototype | Production target |
|---|---|
| `app.jsx` `<App>` — orchestrator + timeline player | Next.js page/route component that subscribes to AG-UI shared state |
| `app.jsx` `run()` (walks scripted steps) | **Replace** with AG-UI/WebSocket event handler that maps incoming deltas → the same state |
| `components.jsx` (`TopBar`, `Witness`, `DetectorCard`, `Gauge`, `Adjudicator`) | Real React components (1:1) |
| `rounds.jsx` (scripted round data) | Optional: keep for demo mode; not needed for live |
| `styles.css` (CSS custom properties + keyframes) | Port to your styling system (CSS modules / Tailwind + a small keyframes file). Tokens listed below |
| `tweaks-panel.jsx` | Prototyping-only tooling — **drop in production** |
| `window.__tellFinal()` / `V` key | Optional presenter "jump to verdict" failsafe |

---

## Screens / Views

### 1. Courtroom (primary, full-screen)
**Purpose:** Watch a round unfold and read the verdict.

**Layout:** CSS grid, full viewport height, three rows:
- `grid-template-rows: 64px 1fr 196px;` → **Top Bar / Stage / Adjudicator**.
- Background: `radial-gradient(120% 90% at 50% 0%, #14182a 0%, #0D0D0D 70%)`.
- A fixed full-screen **scanline overlay** (`body::after`, repeating 2px lines, ~5% black) sits above
  everything (`z-index: 9000`, `pointer-events:none`).
- A fixed full-screen **red vignette** (`.vignette`, `z-index: 8000`) is invisible at rest and flashes on
  the verdict (see Interactions).
- Custom cursor: `crosshair` site-wide.

#### 1a. Top Bar (64px tall)
3-column grid `280px / 1fr / 280px`, bottom border `4px solid #000`, bg `#0a0e18`.
- **Left — Brand:** lightning-bolt SVG (green, drop-shadow glow) + "TELL" wordmark in **Bebas Neue 40px**,
  green `#00FF88` with neon glow; sub-label "AI INTERROGATION SYSTEM v1.0" in **Space Mono 9px**, `#8899AA`.
- **Center — Progress:** label row ("INTERROGATING…" in Space Mono 11px uppercase + right-aligned `%` in
  blue `#00CFFF` bold). Below: **4 phase segments** (SETUP · INTERROGATING · DELIBERATING · VERDICT) as
  flat boxy bars, `3px` black border, no radius. Completed = solid white fill; active = blue fill that
  grows + blue glow; future = dark. Segment label centered in Space Mono 8px (`mix-blend-mode:difference`).
- **Right — Clock + Round + Mode badge:** running `MM:SS` timer (Space Mono 18px bold) + "ROUND n OF N"
  (9px dim). **Mode badge** = 150×44 box: before reveal shows a blurred **"???"** on `#1c2233`; on reveal
  it flips (CSS `scaleX` 1→0.05→1, 0.55s) to a solid colored badge with the mode name (Bebas Neue 19px,
  black text). Mode colors: HONEST=green, LYING=red(+pulse), STRATEGIC DECEPTION=yellow, HALLUCINATING=orange.

#### 1b. Stage (middle, fills remaining height)
2-column grid `35% / 65%`, 16px gap, 16px padding.

**LEFT — "The Witness Stand"** (`.witness`): card, `4px` black border, hard shadow `5px 5px 0 #000`,
bg `#1A1F2E`, column flex. Gains a red glow (`+ 0 0 34px rgba(255,45,85,.5)`) when fused suspicion ≥ 0.70.
- **Header:** 74×74 robot avatar (simple cartoon SVG: square head, antenna, two green eyes, mouth line,
  body; `3px` black strokes) on `#0c1018`, `3px` border, hard shadow, subtle breathing scale loop
  (1→1.02, 3.4s). A **sweat-drop SVG** (cyan) appears top-right of the avatar and bobs only when hot
  (suspicion ≥ 0.70). Beside it: "AGENT WITNESS" (Bebas Neue 30px), "Topic: …" (Space Mono 11px dim), and a
  status pill "SPEAKING"/"STANDING BY" (Space Mono 9px uppercase; green bg when speaking, with 3 blinking dots).
- **Testimony:** heading "TESTIMONY" (Bebas Neue 16px dim) + hairline rule. Scrollable transcript in
  **Courier Prime 13.5px** (`line-height 1.55`):
  - Speaker lines: light text `#d6dde8`, prefixed with green `"> "`.
  - Cross-examiner questions: blue `#00CFFF`, indented 20px, prefixed bold `"Q "`.
  - Human interjections: cyan, prefixed `"[YOU]: "`.
  - The currently-typing line shows a blinking green caret `|` (`steps(1)` 1s).
  - A faint diagonal **"CLASSIFIED"** watermark (Bebas Neue 64px, white at 4% opacity, rotate −18°) sits
    behind the text and is removed on reveal.
  - Auto-scrolls to newest line.

**RIGHT — "The Detective Bureau"** (`.bureau`): 2×2 grid (`1fr 1fr / 1fr 1fr`), 16px gap. Four
**Detector Cards** (`.dcard`), `4px` border, hard shadow, bg `#1A1F2E`, `overflow:hidden`:
- **Header strip** (full-width, colored by detector identity, black text, bottom `3px` black border):
  a simple cartoon icon SVG (thick black stroke, ~20px) + name (Bebas Neue 19px) + persona (Space Mono 8px).
  Identities:
  | Detector | Persona | Header color | Icon |
  |---|---|---|---|
  | CROSS-EXAMINER | THE INTERROGATOR | blue `#00CFFF` | magnifying glass (circle + handle) |
  | CONSISTENCY AUDITOR | THE ARCHIVIST | purple `#B44FFF` | stacked layers |
  | EVIDENCE CHECKER | THE INVESTIGATOR | yellow `#FFE600` | document with lines |
  | BEHAVIORAL ANALYST | THE PROFILER | orange `#FF6B00` | pulse/heartbeat line |
- **Body** = 2-col grid `74px / 1fr`, **and the body must stretch** (`grid-template-rows: 1fr` on the body,
  so the meter column fills full height — this matters for the meter, see below):
  - **Left — vertical suspicion meter** (`.thermo`, 26px wide, `3px` border, bg `#0a0e16`): the percentage
    number sits above in **Space Mono 19px bold** (turns red at ≥85%). Three dashed tick marks at 25/50/75%.
    **Fill is a `position:absolute; inset:0` element revealed via `clip-path: inset(<100−pct>% 0 0 0)`** —
    **do not use percentage `height`** (it fails to resolve against a flex-sized parent; `clip-path`
    resolves reliably and animates). Fill color by level: **<30% green · <60% yellow · <85% orange ·
    ≥85% red**. `transition: clip-path .35s ease, background .3s`. At ≥85% the meter gets an inset red glow
    and the whole card gets a red ring (`0 0 0 3px var(--red)` + red glow).
  - **Right — live rationale feed** (`.feed`, scrollable, **IBM Plex Mono 10.5px**, dim `#8899AA`): each
    entry prefixed with a dim timestamp `[MM:SS]`; newest entry flashes white then fades to dim
    (1.4s); flagging entries tint pink `#ffb3c1`.
- **Footer strip** (`3px` top border, bg `#10141f`): a status pill — `STANDBY` (gray) / `CONFIDENT`
  (green) / `UNCERTAIN` (yellow) / `FLAGGING` (red, pulsing) — and a hidden **"★ DECISIVE"** yellow badge
  that bounces in (`cubic-bezier(.34,1.56,.64,1)`) only on the card that carried the verdict; that card
  also gets a **yellow** ring that supersedes the red flag ring.

#### 1c. Adjudicator (bottom, 196px tall)
2-column grid `1fr / 360px`, top `4px` black border, bg `#0a0e18`, 12px×18px padding.
- **Left — Verdict zone:** a **semicircular speedometer gauge** (SVG, ~280px wide) + the verdict readout.
  - Gauge: arc from **HONEST (left, green)** to **DECEPTIVE (right, red)** with three zones — green
    `0–40%`, yellow `40–65%`, red `65–100%` — drawn as thick (`18px`) `stroke` arcs over a black backing
    arc. Center tick at top. End labels in Bebas Neue 20px (green/red). A **black needle with a red tip**
    pivots from the hub. **Implement the needle rotation via the SVG attribute
    `transform="rotate(<deg> <cx> <cy>)"`** (CSS `transform-origin` on an SVG `<g>` is unreliable across
    engines). Map probability-deceptive `p∈[0,1]` to `deg = (p − 0.5) × 180` (so 0→points left, 0.5→up,
    1→points right). `transition: transform 1.1s cubic-bezier(.34,1.56,.64,1)` for a spring "slam."
  - Readout (flex column, centered): pre-line "THE ADJUDICATOR IS LISTENING…" / "THE PANEL HAS REACHED A
    VERDICT" (Space Mono 11px uppercase dim); **big verdict** (Bebas Neue **58px**, `line-height .85`) —
    dim placeholder "— — —" until fired, then `"<HEAD> — <conf>%"` (e.g. "DECEPTION — 87%") in red, or
    "HONEST — 94%" in green, with neon glow; sub-line (Space Mono 12px dim) naming the decisive detector
    and confidence. `HEAD` is `DECEPTION` for lying/strategic, `FABRICATION` for hallucination, `HONEST`
    for honest.
- **Right — HITL "Ask the Witness":** label (Bebas Neue 18px) + a chunky text input (`3px` border, dark,
  Courier Prime 12px, blue focus ring, placeholder "Type a question to interrogate the witness…") and an
  **INTERJECT** button (Bebas Neue 18px, blue bg, black text, hard shadow, press-down active state). Only
  enabled during the interrogation phase. Below: control buttons **CASE FILE** (yellow, appears after
  reveal), **ROUNDS** (ghost), **REPLAY** (green).

### 2. Start / Round-Select Overlay
Full-screen `rgba(8,10,18,.86)` + blur. Centered card: huge "TELL" (Bebas Neue 92px, green glow), tagline
"A LIVE LIE DETECTOR FOR AI AGENTS" (Space Mono 13px dim), a short description (Courier Prime 14px), a big
green **"▶ BEGIN INTERROGATION"** button (Bebas Neue 27px, `4px` border, hard shadow), and a row of
case-picker chips ("CASE 01/02/03" with topic). In production this becomes your round picker / "start a
live round" control.

### 3. Case File Drawer
Slides up from the bottom (`height 0 → 74%`, `.45s cubic-bezier(.6,.05,.3,1)`), bg `#0c1019`, top `4px`
border. 3-column grid:
- **THE CASE FILE:** a big "✓ PANEL CORRECT" (green) / "✕ PANEL MISSED" (red) badge; rows for Topic,
  Ground truth, Panel verdict, Decisive; and **the secret** revealed (Courier Prime).
- **DETECTIVE PERFORMANCE:** horizontal bars of each detector's final suspicion (sorted desc, colored by
  level, decisive starred); a "best single detector would have caught it / missed it" line (the
  panel-vs-single story).
- **CALIBRATION:** a small scatter plot (predicted confidence x-axis vs. outcome) with the round's point
  highlighted, plus Brier score, accuracy, and false-positive-rate rows, and a green **"NEXT CASE →"** button.

---

## Interactions & Behavior

**Round timeline (prototype's scripted version → drive from live events in prod):**
- `SETUP` → "WITNESS BRIEFING…", progress 0→5%.
- `INTERROGATING` → speaker testimony types in (typewriter ~18ms/char; cross-examiner questions ~30ms/char),
  detector signals update meters + push feed entries, progress fills 5→75% (`5 + 70·turns/maxTurns`).
- `DELIBERATING` → "PANEL DELIBERATING…", progress 75→~92%.
- `VERDICT` → progress 100%; the spike fires (below).
- `REVEALED` → mode badge flips, CASE FILE button appears.

**Typewriter:** implement as a **single elapsed-time-driven timer** that reveals `floor(elapsed/perChar)`
characters — *not* one `setTimeout` per character. (Per-char timers get clamped to ~1s when the tab is
backgrounded and the text crawls; the elapsed-time approach stays wall-clock accurate.)

**THE SPIKE (the single most important moment — must be visceral, all within ~500ms):**
1. The needle **slams** toward DECEPTIVE with spring overshoot (`cubic-bezier(.34,1.56,.64,1)`, 1.1s).
2. The big verdict text **pops in** (scale 0.5→1.18→1) and **shakes** (combine into ONE keyframe ending at
   `scale(1) translateX(0)` with `animation-fill-mode: forwards` — do **not** stack two separate
   `transform` animations; they leave the element collapsed at `scale(0)`).
3. The **screen-edge red vignette** flashes (fade in ~12%, hold, fade out, ~1.1s; scaled by a "spike
   intensity" factor).
4. Cards that contributed flash their red ring; the decisive card gets the yellow ring + ★ DECISIVE badge.
5. The mode badge flips to reveal ground truth simultaneously.

> **Reduced-motion / robustness:** make the *visible resting state* the base style and animate *from* it —
> i.e. the verdict text's base is `scale(1)` and the entrance animates up from `scale(0.5)`, so if an
> animation is interrupted/throttled the text is never fully invisible.

**HITL interjection:** submitting a question appends a `[YOU]:` line to the transcript and (in prod) injects
it as a cross-exam turn to the speaker; the prototype appends a canned deflection + nudges the Behavioral
Analyst meter.

**Idle animations:** avatar breathing (3.4s), speaking dots, sweat drop above 70% suspicion, fill
transitions (0.35s), smooth progress bar.

---

## State Management

The view is a pure function of this state. **Map the live AG-UI shared state / events onto it** (the
WebSocket fallback forwards the same messages):

| UI state | Type | Live source (per `docs/IMPLEMENTATION_PLAN.md` + `SPEC §8`) |
|---|---|---|
| `phase` | `'SETUP'\|'INTERROGATING'\|'DELIBERATING'\|'VERDICT'` | `STATE_DELTA` at `/phase` |
| `progress` | `0–100` | `STATE_DELTA` at `/progress` |
| `transcript[]` | `{who:'speaker'\|'ce'\|'human', text}` | `TEXT_MESSAGE` events (speaker utterances + cross-exam follow-ups) |
| `detectors[key]` | `{ suspicion 0–1, status, feed:[{ts,text,flag}] }` | `STATE_DELTA` at `/suspicion/<detector>` → `suspicion`; `DetectorSignal.rationale`/`.evidence` → feed entry |
| `verdict` | `{label:'honest'\|'deceptive', confidence 0–1, decisive_detector, contributing_signals}` | `CUSTOM` `verdict` event (Adjudicator) |
| `revealed` / `ground_truth` / `mode` | reveal flag + `Round.speaker_mode` | round-complete event / `Round` object |
| `clock` | `MM:SS` since round start | client-side timer |

Derived: `hot = max(suspicion) ≥ 0.70`; meter color from suspicion thresholds; `flag = suspicion ≥ 0.85`;
`HEAD` from mode/label. Detector keys in the prototype: `ce, ca, ev, ba` → backend
`cross_examiner, consistency_auditor, evidence_checker, behavioral_analyst`.

Inbound (HITL): user question → POST/emit to backend → injected as a cross-exam turn.

---

## Design Tokens

**Color**
| Token | Hex | Use |
|---|---|---|
| bg | `#0D0D0D` | page |
| panel | `#111827` | bars |
| card | `#1A1F2E` | cards |
| card-2 | `#141925` | inset surfaces |
| green | `#00FF88` | honest / calm / brand |
| red | `#FF2D55` | deception / alert |
| yellow | `#FFE600` | strategic-deception / decisive / evidence |
| orange | `#FF6B00` | hallucination / behavioral |
| blue | `#00CFFF` | UI accents / cross-examiner |
| purple | `#B44FFF` | consistency auditor |
| text | `#F0F0F0` | primary text |
| dim | `#8899AA` | secondary text |
| outline | `#000000` | all borders |
| meter track | `#0a0e16` | thermo / plot bg |

**Typography** (Google Fonts)
- Display / headers / verdict / names: **Bebas Neue**
- UI labels / percentages / timestamps: **Space Mono** (400/700)
- Transcript / testimony: **Courier Prime** (400/700)
- Detector rationale: **IBM Plex Mono** (400/500)

**Borders / shadows / radius**
- Borders: `3px solid #000` (default), `4px solid #000` (cards & bars). **Radius: 0 everywhere.**
- Shadows are **hard offsets, never blurred**: `5px 5px 0 #000` (cards), `3px 3px 0 #000` (small).
- Neon glow = `text-shadow`/`box-shadow` in the element's accent color, multiplied by a `--glow` factor.

**Spacing:** 16px stage gap/padding; 14px card header/inner padding; 8px control gaps.

**Tunable factors (were Tweaks; optional in prod):** `--spike` (verdict-flash intensity), `--glow`
(neon strength), `--scan-op` (scanline opacity), playback speed.

---

## Assets
- **No external image assets.** All iconography (lightning bolt, robot avatar, four detector icons,
  sweat drop, gauge, calibration plot) is **inline SVG** drawn with thick black strokes — reproduce in
  your component library or copy from `prototype/components.jsx`.
- **Fonts:** load Bebas Neue, Space Mono, Courier Prime, IBM Plex Mono (Google Fonts or `next/font`).
- No brand assets beyond the "TELL" wordmark (plain Bebas Neue text, green).

---

## Files (in `prototype/`)
- `Tell — Interrogation Room.html` — entry point (font links, React+Babel, mounts the app).
- `styles.css` — **all tokens, layout, component styling, and keyframes** (authoritative for visual specs).
- `rounds.jsx` — the three scripted demo rounds + detector identity metadata + mode labels (reusable as
  demo mode; the data shapes mirror the backend interfaces).
- `components.jsx` — `TopBar`, `Witness`, `DetectorCard`, `Gauge`, `Adjudicator`, inline icon SVGs.
- `app.jsx` — `<App>` orchestrator: state, the timeline player (`run()` — replace with the live event
  handler), typewriter, the spike sequence, `Overlay`, `CaseFile`, and the presenter `V`/`__tellFinal` hook.
- `tweaks-panel.jsx` — prototyping tweak controls only; **omit in production.**

Open the HTML file in a browser to see the intended result; click **BEGIN INTERROGATION**, or press **`V`**
to jump straight to the verdict/spike.
