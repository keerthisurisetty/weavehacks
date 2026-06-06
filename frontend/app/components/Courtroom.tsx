"use client";

import { useRound } from "../lib/useRound";
import type { Utterance, Verdict } from "../lib/types";

// Neutral styling on purpose — the design system layers in on top of this
// structure later (meters/transcript/verdict are the stable components).

const DETECTOR_LABELS: Record<string, string> = {
  cross_examiner: "Cross-Examiner",
  consistency_auditor: "Consistency Auditor",
  behavioral_analyst: "Behavioral Analyst",
  evidence_checker: "Evidence Checker",
};

function ProgressBar({ phase, progress }: { phase: string; progress: number }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ fontSize: 13, color: "#555", marginBottom: 4, textTransform: "capitalize" }}>
        {phase === "verdict" ? "Done" : `${phase}…`} {progress}%
      </div>
      <div style={{ height: 6, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            background: "#111",
            transition: "width 300ms linear",
          }}
        />
      </div>
    </div>
  );
}

function Meter({ name, value }: { name: string; value: number }) {
  const pct = Math.round(value * 100);
  const hot = value >= 0.6;
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
        <span>{DETECTOR_LABELS[name] ?? name}</span>
        <span style={{ fontVariantNumeric: "tabular-nums", color: hot ? "#e5484d" : "#333" }}>
          {pct}%
        </span>
      </div>
      <div style={{ height: 10, background: "#eee", borderRadius: 6, overflow: "hidden" }}>
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: hot ? "#e5484d" : "#3b82f6",
            transition: "width 400ms ease, background 400ms ease",
          }}
        />
      </div>
    </div>
  );
}

function TranscriptView({ transcript }: { transcript: Utterance[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {transcript.map((u) => (
        <div
          key={u.id}
          style={{
            alignSelf: u.role === "speaker" ? "flex-start" : "flex-end",
            maxWidth: "80%",
            padding: "8px 12px",
            borderRadius: 10,
            background: u.role === "speaker" ? "#f1f5f9" : "#111",
            color: u.role === "speaker" ? "#111" : "#fff",
            fontSize: 14,
          }}
        >
          <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>
            {u.role === "speaker" ? "Speaker" : "Examiner"}
          </div>
          {u.text}
        </div>
      ))}
      {transcript.length === 0 && <div style={{ color: "#999" }}>No statements yet.</div>}
    </div>
  );
}

function VerdictCard({ verdict }: { verdict: Verdict }) {
  const deceptive = verdict.label === "deceptive";
  return (
    <div
      style={{
        marginTop: 20,
        padding: 20,
        borderRadius: 12,
        textAlign: "center",
        color: "#fff",
        background: deceptive ? "#e5484d" : "#30a46c",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.85, letterSpacing: 1 }}>VERDICT</div>
      <div style={{ fontSize: 32, fontWeight: 700 }}>
        {verdict.label.toUpperCase()} — {Math.round(verdict.confidence * 100)}%
      </div>
      {verdict.decisive_detector && (
        <div style={{ fontSize: 13, opacity: 0.85 }}>
          decisive: {DETECTOR_LABELS[verdict.decisive_detector] ?? verdict.decisive_detector}
        </div>
      )}
    </div>
  );
}

export function Courtroom() {
  const { state, start } = useRound();
  const detectors = Object.keys(state.suspicion);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "2.5rem 1.5rem" }}>
      <header style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ margin: 0 }}>Tell</h1>
          <p style={{ margin: "2px 0 0", color: "#666" }}>A live lie detector for AI agents.</p>
        </div>
        <button
          onClick={start}
          disabled={state.status === "running"}
          style={{
            padding: "10px 18px",
            borderRadius: 8,
            border: "none",
            background: state.status === "running" ? "#999" : "#111",
            color: "#fff",
            fontSize: 14,
            cursor: state.status === "running" ? "default" : "pointer",
          }}
        >
          {state.status === "running" ? "Interrogating…" : "Run a round"}
        </button>
      </header>

      {state.status === "error" && (
        <p style={{ color: "#e5484d" }}>
          Couldn&apos;t reach the backend. Start it with <code>make api</code> (ws://localhost:8000).
        </p>
      )}

      <section style={{ marginTop: 28 }}>
        <ProgressBar phase={state.phase} progress={state.progress} />
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
        <section>
          <h2 style={{ fontSize: 15, textTransform: "uppercase", color: "#888" }}>Suspicion</h2>
          {detectors.length === 0 && <div style={{ color: "#999" }}>Meters idle.</div>}
          {detectors.map((name) => (
            <Meter key={name} name={name} value={state.suspicion[name]} />
          ))}
        </section>
        <section>
          <h2 style={{ fontSize: 15, textTransform: "uppercase", color: "#888" }}>Transcript</h2>
          <TranscriptView transcript={state.transcript} />
        </section>
      </div>

      {state.verdict && <VerdictCard verdict={state.verdict} />}
    </main>
  );
}
