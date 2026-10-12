// src/app/lab/sand/brief-view.test.tsx
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";
import { Brief, type BriefHandle } from "./brief";

test("the brief draws its construction at the projected ball, hairlines only (no glow), and announces the loading", () => {
  const ref = createRef<BriefHandle>();
  const { container } = render(<Brief ref={ref} />);
  ref.current!.update({ cx: 400, cy: 300, r: 100, alpha: 1, dash: 0, squares: Array(9).fill(1), round: 0 });
  // the square (corner radius 0) through its corners; its 8 corner ends with their handles, the centre, the box's 4 corners
  expect(container.querySelector("path[data-brief='shape']")!.getAttribute("d")).toContain("M 300 200");
  expect(container.querySelectorAll("rect[data-brief='anchor']")).toHaveLength(13);
  expect(container.querySelectorAll("line[data-brief='handle']")).toHaveLength(8);
  expect(container.innerHTML).not.toMatch(/drop-shadow|blur\(|feGaussianBlur/);
  ref.current!.announce(0.64);
  expect(screen.getByRole("status")).toHaveTextContent("Loading, 64%");
  ref.current!.announce("ready");
  expect(screen.getByRole("status")).toHaveTextContent("Ready");
});

test("dissolving: the circle breaks into dashes and the squares shrink away", () => {
  const ref = createRef<BriefHandle>();
  const { container } = render(<Brief ref={ref} />);
  ref.current!.update({ cx: 400, cy: 300, r: 100, alpha: 1, dash: 0.6, squares: [0, 1, 1, 1, 1, 0.5, 1, 1, 1], round: 1 });
  expect(container.querySelector("path[data-brief='shape']")!.getAttribute("stroke-dasharray")).not.toBe("none");
  expect(container.querySelectorAll("rect[data-brief='anchor']")[0].getAttribute("width")).toBe("0");
});

test("the brief spans the canvas's box (100vh), not the visible viewport: on phones with the URL bar showing it stays on the ball (final review I3)", () => {
  const { container } = render(<Brief />);
  const cls = container.querySelector("svg")!.getAttribute("class")!;
  expect(cls).toMatch(/\bh-screen\b/);
  expect(cls).toMatch(/\bw-screen\b/);
  expect(cls).not.toMatch(/\bh-full\b/);
});
