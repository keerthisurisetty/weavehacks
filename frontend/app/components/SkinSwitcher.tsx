"use client";

// Mounts EXACTLY ONE of the two front-end skins at a time (never both — each owns
// its own useCourtroom hook + WebSocket, so they must not run simultaneously):
//   "room"  → the original "Interrogation Room" instrument panel (<Courtroom/>)
//   "court" → the comic "Order in the Court" courtroom scene (<CourtroomScene/>)
//
// Initial skin can be deep-linked via ?skin=court|room; a fixed top-corner button
// flips between them. The button updates the URL (without reload) so the choice
// survives a refresh.

import { useEffect, useState } from "react";
import { Courtroom } from "./Courtroom";
import { CourtroomScene } from "./scene/CourtroomScene";

type Skin = "room" | "court";

function readSkin(): Skin {
  if (typeof window === "undefined") return "room";
  return new URLSearchParams(window.location.search).get("skin") === "court" ? "court" : "room";
}

const btnStyle: React.CSSProperties = {
  position: "fixed",
  top: 10,
  right: 12,
  zIndex: 10000,
  fontFamily: "var(--font-bebas), Impact, sans-serif",
  fontSize: 14,
  letterSpacing: 1,
  background: "#00ff88",
  color: "#000",
  border: "3px solid #000",
  boxShadow: "3px 3px 0 #000",
  padding: "7px 13px",
  cursor: "pointer",
};

export function SkinSwitcher() {
  // Render the default on the server; resolve the ?skin= deep-link after mount to
  // avoid a hydration mismatch.
  const [skin, setSkin] = useState<Skin>("room");
  useEffect(() => setSkin(readSkin()), []);

  const toggle = () => {
    const nextSkin: Skin = skin === "court" ? "room" : "court";
    setSkin(nextSkin);
    const url = new URL(window.location.href);
    url.searchParams.set("skin", nextSkin);
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <>
      <button style={btnStyle} onClick={toggle} title="Switch visualization skin">
        {skin === "court" ? "→ INSTRUMENT ROOM" : "→ COURTROOM"}
      </button>
      {skin === "court" ? <CourtroomScene /> : <Courtroom />}
    </>
  );
}
