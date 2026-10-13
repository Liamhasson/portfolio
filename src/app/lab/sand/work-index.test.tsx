// src/app/lab/sand/work-index.test.tsx
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));

import { WorkIndex } from "./work-index";

test("past the last project, About peeks in: the pull to its page (spec 2026-10-12 §2), in both layouts", () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
  render(<WorkIndex bind={() => {}} end={500} />);
  const links = screen.getAllByLabelText("Next: About");   // (by label: role queries fail in the index's container-unit styles under jsdom)
  expect(links).toHaveLength(2);
  for (const l of links) expect(l).toHaveAttribute("href", "/about");
  expect(links[0]).toHaveTextContent("Keep scrolling");   // (Liam, 2026-10-12)
});
