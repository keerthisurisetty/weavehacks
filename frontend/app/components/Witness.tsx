"use client";

import { useEffect, useRef } from "react";
import type { Line } from "../lib/types";
import { RobotAvatar, SweatDrop } from "./icons";

function TLine({ line, live }: { line: Line; live?: boolean }) {
  if (line.who === "speaker")
    return (
      <div className="line speaker">
        {line.text}
        {live && <span className="caret">|</span>}
      </div>
    );
  if (line.who === "human")
    return (
      <div className="line human">
        <span className="tag">[YOU]: </span>
        {line.text}
        {live && <span className="caret">|</span>}
      </div>
    );
  return (
    <div className="line q">
      {line.text}
      {live && <span className="caret">|</span>}
    </div>
  );
}

interface Props {
  topic: string;
  transcript: Line[];
  current: Line | null;
  speaking: boolean;
  hot: boolean;
  revealed: boolean;
}

export function Witness({ topic, transcript, current, speaking, hot, revealed }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [transcript, current]);

  return (
    <div className={`witness${hot ? " hot" : ""}`}>
      <div className="witness-head">
        <div className="avatar">
          <RobotAvatar />
          <SweatDrop />
        </div>
        <div className="witness-meta">
          <div className="name">AGENT WITNESS</div>
          <div className="topic">Topic: {topic}</div>
          <span className={`speak-badge${speaking ? "" : " idle"}`}>
            {speaking ? "SPEAKING" : "STANDING BY"}
            <span className="dots">
              <span />
              <span />
              <span />
            </span>
          </span>
        </div>
      </div>
      <div className="testimony-head">
        TESTIMONY <span className="rule" />
      </div>
      <div className="transcript" ref={ref}>
        {!revealed && <div className="classified">CLASSIFIED</div>}
        {transcript.map((l, i) => (
          <TLine key={i} line={l} />
        ))}
        {current && <TLine line={current} live />}
      </div>
    </div>
  );
}
