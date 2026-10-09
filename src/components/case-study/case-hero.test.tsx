import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { eventread } from "@/content/case-studies/eventread";
import { CaseHero } from "./case-hero";

test("hero: the page's only h1, descriptor, line, link out", () => {
  render(<CaseHero study={eventread} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Eventread");
  expect(screen.getByText("SaaS web app")).toBeInTheDocument();
  expect(screen.getByText("The check every booker skips.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Visit site" })).toHaveAttribute("href", "https://eventread.vercel.app");
});
