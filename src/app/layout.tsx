import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import { MotionPreferences } from "@/components/providers/motion-preferences";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { PillNav } from "@/components/shell/pill-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Liam Hasson | Product Designer", template: "%s | Liam Hasson" },
  description: "Product designer who researches, prototypes and ships products people trust.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-bg"
        >
          Skip to content
        </a>
        <MotionPreferences>
          <SmoothScroll>
            <main id="main" tabIndex={-1} className="outline-none">{children}</main>
            <PillNav />
          </SmoothScroll>
        </MotionPreferences>
      </body>
    </html>
  );
}
