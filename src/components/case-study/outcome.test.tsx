import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { cyvore } from "@/content/case-studies/cyvore";
import { eventread } from "@/content/case-studies/eventread";
import { Outcome } from "./outcome";

test("outcome with a quote", () => {
  render(<Outcome outcome={cyvore.outcome} />);
  expect(screen.getByRole("region", { name: "Outcome" })).toBeInTheDocument();
  expect(screen.getByRole("blockquote")).toHaveTextContent("we closed our first funding round");
  expect(screen.getByText("Yoav Rotem")).toBeInTheDocument();
});

test("outcome with a link", () => {
  render(<Outcome outcome={eventread.outcome} />);
  expect(screen.getByRole("link", { name: "Try it" })).toHaveAttribute("href", "https://eventread.vercel.app");
});
