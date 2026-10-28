import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import "./globals.css";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo", display: "swap" });

export const metadata: Metadata = {
  title: "המשימות שלי",
  description: "ניהול משימות חכם במרחבים, עם סוכן AI",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body>{children}</body>
    </html>
  );
}
