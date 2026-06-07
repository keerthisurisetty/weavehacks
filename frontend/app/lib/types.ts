// Wire types (mirror backend app/events.py RoundEvent) + the UI state shape.

import type { BackendMode, DetectorKey, Status } from "./identities";

export type Role = "speaker" | "examiner" | "human";

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
  abstained?: boolean;
}

export interface Verdict {
  label: "honest" | "deceptive";
  confidence: number;
  contributing_signals?: string[];
  decisive_detector?: string | null;
}

export interface RoundEvent {
  kind: "progress" | "utterance" | "signal" | "verdict" | "reveal";
  phase?: string | null;
  progress?: number | null;
  utterance?: Utterance | null;
  signal?: Signal | null;
  verdict?: Verdict | null;
  mode?: BackendMode | null;
  ground_truth?: "honest" | "deceptive" | null;
  secret?: string | null;
  correct?: boolean | null;
}

// ---- UI state ----
export type Who = "speaker" | "ce" | "human";

export interface Line {
  who: Who;
  text: string;
}

export interface FeedEntry {
  ts: string;
  text: string;
  flag: boolean;
}

export interface DetectorState {
  s: number;
  status: Status;
  feed: FeedEntry[];
  flash: boolean;
}

export interface UiVerdict {
  label: "honest" | "deceptive";
  conf: number;
  head: string;
  decisive: DetectorKey | null;
  contributing: DetectorKey[];
}

export interface CourtroomState {
  phaseIdx: number;
  progress: number;
  banner: string;
  transcript: Line[];
  current: Line | null;
  speaking: boolean;
  dets: Record<DetectorKey, DetectorState>;
  gauge: number;
  verdict: UiVerdict | null;
  verdictFired: boolean;
  decisive: DetectorKey | null;
  revealed: boolean;
  mode: BackendMode | null;
  groundTruth: "honest" | "deceptive" | null;
  secret: string | null;
  correct: boolean | null;
  vigFire: boolean;
  clock: string;
  status: "idle" | "running" | "done" | "error";
}
