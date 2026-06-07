import type { ReactNode } from "react";
import { Bangers, Bebas_Neue, Courier_Prime, IBM_Plex_Mono, Space_Mono } from "next/font/google";
import "./courtroom.css";

const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], variable: "--font-bebas" });
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-space" });
const courier = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-courier",
});
const plex = IBM_Plex_Mono({ weight: ["400", "500"], subsets: ["latin"], variable: "--font-plex" });
// Comic "BANG!" burst for the courtroom scene skin (--font-comic).
const bangers = Bangers({ weight: "400", subsets: ["latin"], variable: "--font-comic-bangers" });

export const metadata = {
  title: "Tell — The Interrogation Room",
  description: "A live, black-box, multi-agent lie detector for AI agents.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fontVars = `${bebas.variable} ${spaceMono.variable} ${courier.variable} ${plex.variable} ${bangers.variable}`;
  // suppressHydrationWarning: browser extensions (Grammarly, etc.) inject
  // attributes onto <html>/<body> before React hydrates — harmless, but noisy.
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
