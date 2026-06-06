import type { ReactNode } from "react";

export const metadata = {
  title: "Tell — live lie detector for AI agents",
  description:
    "A panel of detector agents interrogates a speaker and calls deception live.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body
        style={{ margin: 0, fontFamily: "system-ui, -apple-system, sans-serif" }}
      >
        {children}
      </body>
    </html>
  );
}
