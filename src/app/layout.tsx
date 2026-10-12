import type { Metadata } from "next";
import { fontVariables } from "./fonts";
import { MotionPreferences } from "@/components/providers/motion-preferences";
import { SmoothScroll } from "@/components/providers/smooth-scroll";
import { PillNav } from "@/components/shell/pill-nav";
import { NavName } from "@/components/shell/nav-name";
import { rootMetadata } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = rootMetadata;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // (suppressHydrationWarning: the story's loader sets html[data-loader] before first paint, src/app/lab/sand/loader-mode.ts)
    <html lang="en" className={fontVariables} suppressHydrationWarning>
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
            <NavName />
            <PillNav />
          </SmoothScroll>
        </MotionPreferences>
      </body>
    </html>
  );
}
