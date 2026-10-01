import type { Metadata } from "next";
import { AttributionCapture } from "@/components/tracking/AttributionCapture";
import { FunnelTracker } from "@/components/tracking/FunnelTracker";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEOLIFE — Business Opportunity",
  description:
    "Learn about the NEOLIFE business opportunity. Register your interest and meet the team.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="bg-white text-neutral-900 antialiased">
        <AttributionCapture />
        <FunnelTracker />
        {children}
      </body>
    </html>
  );
}
