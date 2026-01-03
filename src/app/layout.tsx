import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hume AI Document Reader",
  description: "Upload documents or paste text and have them read aloud with expressive AI voices powered by Hume AI's Octave TTS",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  );
}
