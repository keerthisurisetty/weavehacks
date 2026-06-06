"use client";

import { useEffect, useRef } from "react";
import { type DetectorMeta, fillColor } from "../lib/identities";
import type { DetectorState } from "../lib/types";
import { DIcon } from "./icons";

interface Props {
  meta: DetectorMeta;
  state: DetectorState;
  decisive: boolean;
}

export function DetectorCard({ meta, state, decisive }: Props) {
  const s = state.s;
  const flag = s >= 0.85;
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [state.feed.length]);

  return (
    <div className={`dcard${flag ? " flag" : ""}${decisive ? " decisive" : ""}${state.flash ? " flash" : ""}`}>
      <div className="dcard-head" style={{ background: meta.hex }}>
        <span className="ic">
          <DIcon kind={meta.icon} />
        </span>
        <div>
          <div className="nm">{meta.name}</div>
          <div className="pn">{meta.persona}</div>
        </div>
      </div>
      <div className="dcard-body">
        <div className="meter-col">
          <div className="meter-num" style={{ color: flag ? "var(--red)" : "var(--text)" }}>
            {Math.round(s * 100)}%
          </div>
          <div className={`thermo${flag ? " flag" : ""}`}>
            {[25, 50, 75].map((t) => (
              <div key={t} className="tick" style={{ bottom: `${t}%` }} />
            ))}
            <div
              className="fill"
              style={{ clipPath: `inset(${100 - s * 100}% 0 0 0)`, background: fillColor(s) }}
            />
          </div>
        </div>
        <div className="feed" ref={ref}>
          {state.feed.length === 0 && (
            <div className="entry" style={{ opacity: 0.5 }}>
              [ awaiting testimony ]
            </div>
          )}
          {state.feed.map((e, i) => (
            <div
              key={i}
              className={`entry${i === state.feed.length - 1 ? " fresh" : ""}${e.flag ? " flagrow" : ""}`}
            >
              <span className="ts">[{e.ts}] </span>
              {e.text}
            </div>
          ))}
        </div>
      </div>
      <div className="dcard-foot">
        <span className={`status-pill ${state.status}`}>{state.status.toUpperCase()}</span>
        <span className="trophy">★ DECISIVE</span>
      </div>
    </div>
  );
}
