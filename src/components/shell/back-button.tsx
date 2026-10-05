import Link from "next/link";

export function BackButton({ slug }: { slug: string }) {
  return (
    <Link
      href={`/#${slug}`}
      aria-label="Back to projects"
      className="fixed left-6 top-6 z-50 flex size-11 items-center justify-center rounded-full bg-ink text-bg transition-transform duration-(--duration-micro) ease-(--ease-settle) hover:-translate-x-0.5"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
