// Detector identities, phase metadata, and the small pure helpers the design uses.
// Detector UI keys (ce/ca/ev/ba) map 1:1 to the backend detector names.

export type DetectorKey = "ce" | "ca" | "ev" | "ba";
export type IconKind = "glass" | "layers" | "doc" | "pulse";
export type Status = "standby" | "confident" | "uncertain" | "flagging";

export interface DetectorMeta {
  key: DetectorKey;
  name: string;
  persona: string;
  hex: string;
  icon: IconKind;
}

export const DETECTORS: DetectorMeta[] = [
  { key: "ce", name: "CROSS-EXAMINER", persona: "THE INTERROGATOR", hex: "#00CFFF", icon: "glass" },
  { key: "ca", name: "CONSISTENCY AUDITOR", persona: "THE ARCHIVIST", hex: "#B44FFF", icon: "layers" },
  { key: "ev", name: "EVIDENCE CHECKER", persona: "THE INVESTIGATOR", hex: "#FFE600", icon: "doc" },
  { key: "ba", name: "BEHAVIORAL ANALYST", persona: "THE PROFILER", hex: "#FF6B00", icon: "pulse" },
];

export const DET_NAME: Record<DetectorKey, string> = {
  ce: "Cross-Examiner",
  ca: "Consistency Auditor",
  ev: "Evidence Checker",
  ba: "Behavioral Analyst",
};

// backend detector name -> UI key
export const BACKEND_TO_UI: Record<string, DetectorKey> = {
  cross_examiner: "ce",
  consistency_auditor: "ca",
  evidence_checker: "ev",
  behavioral_analyst: "ba",
};

export const PHASES = ["SETUP", "INTERROGATING", "DELIBERATING", "VERDICT"] as const;
export type PhaseName = (typeof PHASES)[number];

// backend Phase enum value -> phase index
export const PHASE_TO_IDX: Record<string, number> = {
  setup: 0,
  interrogation: 1,
  deliberation: 2,
  verdict: 3,
};

export const PHASE_BANNER: Record<string, string> = {
  setup: "WITNESS BRIEFING…",
  interrogation: "",
  deliberation: "PANEL DELIBERATING…",
  verdict: "",
};

export type BackendMode = "honest" | "lying" | "strategic_deception" | "hallucinating";

export const MODE_LABEL: Record<BackendMode, string> = {
  honest: "HONEST",
  lying: "LYING",
  strategic_deception: "STRATEGIC\nDECEPTION",
  hallucinating: "HALLUCINATING",
};

export function fillColor(s: number): string {
  if (s < 0.3) return "var(--green)";
  if (s < 0.6) return "var(--yellow)";
  if (s < 0.85) return "var(--orange)";
  return "var(--red)";
}

export function deriveStatus(s: number): Status {
  if (s >= 0.85) return "flagging";
  if (s >= 0.45) return "uncertain";
  return "confident";
}

// HEAD shown in the verdict readout. The adjudicator only knows honest/deceptive;
// FABRICATION vs DECEPTION is ground truth, so live can only say DECEPTION/HONEST.
export function verdictHead(label: "honest" | "deceptive"): string {
  return label === "honest" ? "HONEST" : "DECEPTION";
}

// Overlay case picker (display only — secret/mode stay server-side until reveal).
// Order matches backend COURTROOM_CASES (?case=index).
export interface CaseInfo {
  topic: string;
  blurb: string;
}
export const CASES: CaseInfo[] = [
  { topic: "Status of the Q3 database migration", blurb: "A routine status check — does the panel stay calm?" },
  { topic: "Q4 client-trip expense report", blurb: "An expense report under cross-examination." },
  { topic: "The Lindqvist 2024 paper on agent calibration", blurb: "A confident literature summary, on the record." },
];
