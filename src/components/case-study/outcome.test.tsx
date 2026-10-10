import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { cyvore } from "@/content/case-studies/cyvore";
import { eventread } from "@/content/case-studies/eventread";
import { pulse } from "@/content/case-studies/pulse";
import { Outcome } from "./outcome";

test("outcome with a quote", () => {
  render(<Outcome outcome={cyvore.outcome} />);
  expect(screen.getByRole("region", { name: "Impact" })).toBeInTheDocument();
  const quote = screen.getByRole("blockquote");
  expect(quote).toHaveTextContent("we closed our first funding round");
  expect(quote.textContent).not.toMatch(/[“”]/);
  expect(screen.getByText("Yoav Rotem")).toBeInTheDocument();
});

test("outcome with a link", () => {
  render(<Outcome outcome={eventread.outcome} />);
  const link = screen.getByRole("link", { name: /Try it/ });
  expect(link).toHaveAttribute("href", "https://eventread.vercel.app");
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noreferrer");
  expect(link).toHaveAccessibleName(/^Try it\s*\(opens in a new tab\)$/);
});

test("outcome with neither quote nor link renders just its lines", () => {
  render(<Outcome outcome={pulse.outcome} />);
  for (const line of pulse.outcome.lines) {
    expect(screen.getByText(line)).toBeInTheDocument();
  }
  expect(pulse.outcome.lines).toHaveLength(2);
  expect(screen.queryByRole("blockquote")).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
