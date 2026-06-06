// Mirrors the backend RoundEvent JSON (app/events.py, model_dump(mode="json")).

export type Role = "speaker" | "examiner";

export interface Utterance {
  id: string;
  role: Role;
  text: string;
  turn?: number | null;
}

export interface Signal {
  detector: string;
  suspicion: number;
  utterance_ref?: string | null;
  evidence?: string | null;
  rationale?: string;
}

export interface Verdict {
  label: "honest" | "deceptive";
  confidence: number;
  contributing_signals?: string[];
  decisive_detector?: string | null;
}

export interface RoundEvent {
  kind: "progress" | "utterance" | "signal" | "verdict";
  phase?: string | null;
  progress?: number | null;
  utterance?: Utterance | null;
  signal?: Signal | null;
  verdict?: Verdict | null;
}
