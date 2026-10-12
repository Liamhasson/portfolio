// src/app/lab/sand/brief-view.test.tsx
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { expect, test } from "vitest";
import { Brief, type BriefHandle } from "./brief";

test("the brief draws its construction at the projected ball, hairlines only (no glow), and announces the loading", () => {
  const ref = createRef<BriefHandle>();
  const { container } = render(<Brief ref={ref} />);
  ref.current!.update({ cx: 400, cy: 300, r: 100, alpha: 1, dash: 0, squares: Array(9).fill(1) });
  const circle = container.querySelector("circle[data-brief='circle']")!;
  expect(circle.getAttribute("cx")).toBe("400");
  expect(circle.getAttribute("r")).toBe("100");
  expect(container.querySelectorAll("rect[data-brief='anchor']")).toHaveLength(9);
  expect(container.innerHTML).not.toMatch(/drop-shadow|blur\(|feGaussianBlur/);
  ref.current!.announce(0.64);
  expect(screen.getByRole("status")).toHaveTextContent("Loading, 64%");
  ref.current!.announce("ready");
  expect(screen.getByRole("status")).toHaveTextContent("Ready");
});

test("dissolving: the circle breaks into dashes and the squares shrink away", () => {
  const ref = createRef<BriefHandle>();
  const { container } = render(<Brief ref={ref} />);
  ref.current!.update({ cx: 400, cy: 300, r: 100, alpha: 1, dash: 0.6, squares: [0, 1, 1, 1, 1, 0.5, 1, 1, 1] });
  expect(container.querySelector("circle[data-brief='circle']")!.getAttribute("stroke-dasharray")).not.toBe("none");
  expect(container.querySelectorAll("rect[data-brief='anchor']")[0].getAttribute("width")).toBe("0");
});
