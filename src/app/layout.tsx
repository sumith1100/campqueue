import type { Metadata, Viewport } from "next";
import "@fontsource-variable/bricolage-grotesque/wdth.css";
import "@fontsource-variable/figtree/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CampQueue", template: "%s · CampQueue" },
  description: "Take a token, wait anywhere, and get called when it is your turn at the health camp.",
  manifest: "/manifest.webmanifest",
  applicationName: "CampQueue",
};

export const viewport: Viewport = {
  themeColor: "#edf2f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
