# Handoff: TELL — "Order in the Court" (Courtroom UI)

## Overview
**Tell** is a live, black-box, multi-agent lie detector for AI agents. A *speaker* agent is
interrogated in real time by a panel of *detector* agents; their suspicion rises live, and the instant
the speaker starts to deceive the panel converges on a calibrated verdict, then the ground truth is
revealed.

This handoff covers the **Courtroom visualization** — an alternative front-end to the same engine, staged
as a comic-book trial. Every agent is an **expressive robot character that speaks in comic bubbles**:

| Court role | Tell component | Drives |
|---|---|---|
| **The Witness** (accused) | the *speaker* agent on trial | testimony speech bubbles; gets visibly nervous as suspicion climbs |
| **The Cross-Examiner** (prosecutor, at a podium) | `cross_examiner` detector | asks the questions (spoken bubbles) **and** has its own suspicion meter |
| **The Jury** (3 jurors in a box) | `consistency_auditor`, `evidence_checker`, `behavioral_analyst` | each reacts with facial expressions + a suspicion meter + a rationale "mutter" bubble |
| **The Adjudicator** (the judge at the bench) | the Adjudicator | bangs the gavel, drops the verdict banner |
| **Scales of Justice** (top-left prop) | fused suspicion → verdict | tips between TRUTH and LIES in real time; slams at the verdict |

Aesthetic: **"Neon Noir Cartoon"** — hard black outlines, offset (non-blurred) drop shadows, saturated
neon glow, CRT scanlines — rendered as a single theatrical stage.

> This is the **second of two** front-end directions. The first (the "Interrogation Room" instrument
> panel) ships under `design_handoff_courtroom_ui/` (your existing handoff). **Both are driven by the
> exact same round/event model** — see *State Management*. They are interchangeable views; you can ship
> one, or offer both as skins.

---

## About the Design Files
The files in `prototype/` are a **design reference built in HTML/React-via-Babel** — a working prototype
showing the intended look, motion, and behavior. **They are not production code to ship as-is.**

Recreate this UI inside the real Tell frontend (Next.js + React + CopilotKit/AG-UI, FastAPI WebSocket
fallback) using that codebase's patterns. The prototype drives itself from a **scripted timeline**
(`rounds.jsx`); in production you replace that with the **live AG-UI shared-state / event stream**. Only
the data source changes — the scene, characters, animations, and tokens should be reproduced faithfully.

The data model is a 1:1 mirror of the backend interfaces in `docs/SPEC.md §8` (`DetectorSignal`,
`Verdict`, `Round`), so the wiring is mechanical (see *State Management*).

> Keep the scripted-timeline mode as a **deterministic demo failsafe** for stage use — the prototype
> already exposes a presenter shortcut: pressing **`V`** (or `window.__courtFinal()`) jumps straight to
> the gavel/verdict.

---

## Fidelity
**High-fidelity.** Final colors, type, spacing, shadows, and motion are specified below and present in
`prototype/courtroom-styles.css`. Recreate faithfully. The scene is composed on a fixed **1600×940**
stage that is **uniformly scaled to fit** any viewport (letterboxed on black) — best on a laptop/monitor
demo. Below ~1000px it simply scales down.

---

## Tech mapping (prototype → production)
| Prototype file | Production target |
|---|---|
| `courtroom-app.jsx` `<CourtApp>` — orchestrator + timeline player (`run()`) + stage scaler | Next.js page that subscribes to AG-UI shared state; **replace `run()`** with the live event handler that maps deltas → the same state |
| `courtroom-characters.jsx` — `Character`, `Gavel`, `Scales`, `MiniIcon` | React components (inline SVG) — reproduce 1:1 |
| `courtroom-scene.jsx` — `JudgeBench`, `WitnessStand`, `Podium`, `JuryBox`, `Bubble`, `Mutter`, `InfoPlacard`, `Rail`, `Overlay`, `CaseFile` | Real React components |
| `courtroom-styles.css` — tokens, layout, keyframes | Port to your styling system; tokens listed below |
| `rounds.jsx` — scripted rounds + detector identity metadata | Optional: keep for demo mode; not needed for live |
| `window.__courtFinal()` / `V` key | Optional presenter "jump to verdict" failsafe |

---

## The Stage & Composition

A single **1600×940** stage (`.stage`), absolutely centered and uniformly scaled to the viewport via
`transform: translate(-50%,-50%) scale(s)` where `s = min(vw/1600, vh/940)` (recompute on resize; guard
against a 0 from a not-yet-laid-out window — see the prototype's `fit()`). Backdrop: a radial wall
gradient, faint pillar stripes, a glowing circular **court seal** behind the judge, and a floor band with
perspective lines. A fixed CRT-scanline overlay and a full-stage red **verdict flash** layer sit on top.

**Zones (absolute within the 1600×940 stage):**
- **Top-left — Scales of Justice** (`.scales-zone`, the live verdict meter).
- **Top-center — Judge's bench** (`.bench`): the Adjudicator character behind a tall desk, a gavel, the
  glowing seal, and the drop-down **verdict banner**.
- **Top-right — Info placard** (`.info-zone`): clock, case number, 4-segment phase progress
  (SETUP·INTERROGATING·DELIBERATING·VERDICT), and the **"???" mode placard** that flips on reveal.
- **Left — Witness stand** (`.witness-zone`): the Witness character in a raised booth + nameplate; a red
  glow aura when fused suspicion ≥ 0.70.
- **Center-front — Prosecutor podium** (`.podium-zone`): the Cross-Examiner behind an angled lectern, with
  a small suspicion badge.
- **Right — Jury box** (`.jury-zone`): three jurors in a row, each with a nameplate, suspicion meter, and
  status chip.
- **Bottom — Control rail** (`.rail`): a "COURT RECORD" ticker (latest spoken line), the human-in-the-loop
  **OBJECT** input ("Ask the witness"), and **CASE FILE / CASES / REPLAY** buttons.

Speech is layered **above** the zones: large white comic **`.bubble`s** for testimony (witness) and
questions (cross-examiner / human), and smaller colored **`.mutter`s** for each detector's live rationale
(positioned just above its character; capped height with `overflow:hidden`).

---

## The Characters (most important part)

Each agent is a parametric robot drawn as inline SVG (`Character` in `courtroom-characters.jsx`): a
rounded-rect head with an antenna, color "ear" tabs and a brow bar in the detector's accent color, eyes,
eyebrows, and a mouth — plus a torso behind the furniture. **Expressions are computed from suspicion**
(`exprFromSus(s)`), and the character also **leans in** more as it gets suspicious:

| State | Suspicion | Eyes | Eyebrows | Mouth | Body | Extra |
|---|---|---|---|---|---|---|
| `calm` | < ~0.3 | open, round | flat, slightly raised | gentle smile | upright | — |
| `watch` | ~0.3–0.55 | slightly narrowed, pupils down | flat | straight line | small lean (`lean-1`) | — |
| `sus` | ~0.55–0.85 | narrowed | inner-down (angry) | frown | lean forward (`lean-2`) | — |
| `alarm` | ≥ 0.85 | wide, **red** sclera | raised | open gasp | pop forward | red glow on head |

- **Speaking** swaps the mouth for an animated talking ellipse (`mouth-talk`, `@keyframes talk`).
- **The Witness** uses witness-tuned thresholds (panics a touch earlier) and shows **sweat drops**
  (`@keyframes sweatDrop`) at `sus`/`alarm`; its booth gains a red aura when the panel runs hot.
- **Role accessories**: judge = white powdered **wig** + stern; prosecutor = **necktie**; jurors = plain.
- **The Judge** stays stoic (`calm`) until the verdict, then reads stern (`sus`) for deception / approving
  for honest, and **bangs the gavel** (`@keyframes gavelBang`) with a comic **"BANG!"** burst.

---

## Key Props & Behavior

### Scales of Justice (the live verdict meter)
`Scales({ p })` where `p` = fused probability-deceptive (0..1). A rigid balance beam + two hanging pans
(**TRUTH** green left, **LIES** red right) rotate as one group: `deg = (p − 0.5) × 34`, applied as the
**SVG attribute** `transform="rotate(deg 160 58)"` (not a CSS transform — attribute rotation is reliable
across engines), with `transition: transform 1s cubic-bezier(.34,1.56,.64,1)` for a spring tip/slam.
`p≈0` → tips left (truth-heavy, honest); `p≈1` → tips right (lies-heavy); the needle slams at verdict.

### Speech bubbles
- `Bubble` — comic style: white fill, 4px black border, hard shadow, a colored name tab (`.who`,
  `white-space:nowrap`), a CSS-triangle tail pointing at the speaker, and a typewriter caret while live.
  Kinds: `witness` (testimony), `ce` (cross-examiner question, blue tab), `human` (your interjection,
  dark cyan).
- `Mutter` — a small detector rationale bubble in the detector's tint (pink when flagging), anchored just
  above that character; replaced (not stacked) as new rationale arrives.

### The verdict choreography ("the gavel moment")
On the `verdict` event, within ~1s: (1) the **gavel bangs** + "BANG!" burst; (2) the **scales slam** to
the verdict side; (3) a **verdict banner** drops onto the bench — `"<HEAD> — <conf>%"` (red for
deception, green for honest) with the decisive detector named; (4) a **red screen flash**; (5) the
**decisive** juror/podium gets a spotlight + **★ DECISIVE** ribbon; (6) the mode placard **flips** to
reveal ground truth. `HEAD` = `DECEPTION` (lying/strategic), `FABRICATION` (hallucination), `HONEST`.

### Robustness notes (lessons already baked into the prototype)
- **Typewriter**: drive it from a **single elapsed-time timer** that reveals `floor(elapsed/perChar)`
  characters — *not* one `setTimeout` per character (per-char timers get clamped to ~1s when the tab is
  backgrounded and the text crawls).
- **Entrance animations** (`bubbleIn`, `bannerDrop`): animate **transform only**, keep the resting
  **opacity:1** — never gate visibility on an `opacity:0→1` keyframe, or a throttled/reduced-motion view
  freezes the element invisible at frame 0.
- Make the visible end-state the base style and animate *from* a hidden transform.

---

## State Management

The whole scene is a pure function of this state. **Map the live AG-UI shared state / events onto it**
(the WebSocket fallback forwards the same messages):

| UI state | Type | Live source (per `docs/IMPLEMENTATION_PLAN.md` + `SPEC §8`) |
|---|---|---|
| `phase` | `SETUP\|INTERROGATING\|DELIBERATING\|VERDICT` | `STATE_DELTA` at `/phase` |
| `progress` | `0–100` | `STATE_DELTA` at `/progress` |
| `witnessSay` / `ask` | speaker testimony / cross-exam (or human) question | `TEXT_MESSAGE` events (route by author: speaker→witness bubble, cross-examiner→podium bubble, user→human bubble) |
| `dets[key]` | `{ suspicion 0–1, status }` | `STATE_DELTA` at `/suspicion/<detector>` → suspicion; status from the signal |
| `mutters[key]` | latest rationale string + flag | `DetectorSignal.rationale` / `.evidence` |
| `gaugeP` (scales) | fused prob-deceptive | the Adjudicator's running fused score (max/most-recent of detector suspicions in the prototype) |
| `verdict` | `{ label:'honest'\|'deceptive', confidence, head, decisive_detector, contributing }` | `CUSTOM` `verdict` event |
| `revealed` / `mode` | reveal flag + `Round.speaker_mode` | round-complete event / `Round` object |
| `clock` | `MM:SS` since round start | client-side timer |

Derived: `maxSus = max(suspicion)` → witness nervousness + booth aura; per-character `expr` from its own
suspicion; `flag = suspicion ≥ 0.85`; `HEAD` from mode/label. Detector keys in the prototype:
`ce, ca, ev, ba` → backend `cross_examiner, consistency_auditor, evidence_checker, behavioral_analyst`.
Inbound (HITL): the **OBJECT** input → emit user question to backend → injected as a cross-exam turn.

---

## Design Tokens

**Color**
| Token | Hex | Use |
|---|---|---|
| bg / wall / floor | `#0D0D0D` / `#141a2e` / `#1b2236` | stage backdrop layers |
| card / wood | `#1A1F2E` / `#20283f` | furniture panels |
| green | `#00FF88` | honest / calm / TRUTH / judge brand |
| red | `#FF2D55` | deception / alert / LIES / flash |
| yellow | `#FFE600` | strategic-deception / decisive / evidence |
| orange | `#FF6B00` | hallucination / behavioral |
| blue | `#00CFFF` | UI accents / cross-examiner / witness |
| purple | `#B44FFF` | consistency auditor |
| text / dim | `#F0F0F0` / `#8899AA` | primary / secondary text |
| outline | `#000000` | all borders |

**Typography** (Google Fonts)
- Display / names / verdict / nameplates: **Bebas Neue**
- Comic "BANG!": **Bangers**
- UI labels / percentages / mutters: **Space Mono** (400/700)
- Speech-bubble testimony: **Courier Prime** (400/700)
- (Calibration/secondary mono): **IBM Plex Mono**

**Borders / shadows / radius**
- Borders `3px`/`4px solid #000`. **Radius: 0** (furniture, bubbles, plates).
- Shadows are **hard offsets, never blurred**: `5px 5px 0 #000` (panels), `3px 3px 0 #000` (small),
  `8px 8px 0 #000` (banner).
- Neon glow = accent-colored `text-shadow`/`box-shadow`, multiplied by a `--glow` factor.
- Tunable factors (optional in prod): `--spike` (flash intensity), `--glow`, `--scan-op` (scanlines).

---

## Assets
- **No external image assets.** Every character, the gavel, the scales, the seal, detector icons, and the
  calibration plot are **inline SVG** with thick black strokes — reproduce from
  `prototype/courtroom-characters.jsx` and `courtroom-scene.jsx`.
- **Fonts:** Bebas Neue, Bangers, Space Mono, Courier Prime, IBM Plex Mono (Google Fonts or `next/font`).
- The "TELL" wordmark is plain Bebas Neue text (green).

---

## Files (in `prototype/`)
- `Tell — Courtroom.html` — entry point (font links, React+Babel, loads the four scripts in order).
- `courtroom-styles.css` — **authoritative** for tokens, zone layout, furniture, bubbles, and keyframes.
- `courtroom-characters.jsx` — `Character` (expressions/roles), `Gavel`, `Scales`, `MiniIcon`,
  `exprFromSus`.
- `courtroom-scene.jsx` — the bench / stand / podium / jury / placard / rail / overlay / case-file
  components, plus the `ROLES` map (which detector key plays which court role).
- `courtroom-app.jsx` — `<CourtApp>` orchestrator: state, the timeline `run()` (**replace with the live
  event handler**), the elapsed-time typewriter, the verdict choreography, the stage scaler, and the
  presenter `V`/`__courtFinal` hook.
- `rounds.jsx` — the three scripted demo rounds + detector identity metadata + mode labels (shared with
  the Interrogation Room build; the data shapes mirror the backend interfaces).

Open the HTML in a browser to see the intended result: click **⚖ CALL THE COURT TO ORDER**, or press
**`V`** to jump to the gavel/verdict. Try **OBJECT** to question the witness, and **CASE FILE** after a
verdict for the post-trial breakdown.
