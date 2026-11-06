import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "ParaLearn Results",
  description: "Turn a term's result sheet into printable report cards, with or without internet.",
  manifest: "/rms.webmanifest",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "ParaLearn Results", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#641bc4" };

export default function ResultStudioLayout({ children }: { children: React.ReactNode }) {
  return children;
}
