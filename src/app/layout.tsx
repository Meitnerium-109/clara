import type { Metadata, Viewport } from "next";
import { Noto_Sans, Noto_Sans_Devanagari, Noto_Sans_Telugu } from "next/font/google";
import "./globals.css";

// next/font downloads these at build time and serves them from our own domain:
// no request to Google from the patient's phone, and only the subsets we need.
const notoSans = Noto_Sans({
  subsets: ["latin"],
  variable: "--font-noto-sans",
  display: "swap",
});

// Not preloaded: the browser fetches them only when a page actually shows
// Telugu or Hindi text, so English-only pages stay light.
const notoTelugu = Noto_Sans_Telugu({
  subsets: ["telugu"],
  variable: "--font-noto-telugu",
  display: "swap",
  preload: false,
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-devanagari",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "Clara",
  description: "Your lab reports, clear and safe.",
};

export const viewport: Viewport = {
  themeColor: "#e3f4f1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${notoSans.variable} ${notoTelugu.variable} ${notoDevanagari.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
