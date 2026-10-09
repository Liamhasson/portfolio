import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { cyvore } from "@/content/case-studies/cyvore";
import { eventread } from "@/content/case-studies/eventread";
import { CaseHero } from "./case-hero";

test("hero: the page's only h1, descriptor, line, link out", () => {
  render(<CaseHero study={eventread} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Eventread");
  expect(screen.getByText("SaaS web app")).toBeInTheDocument();
  expect(screen.getByText("The check every booker skips.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Visit site/ })).toHaveAttribute("href", "https://eventread.vercel.app");
});

test("hero: the h1 can take programmatic focus for transitions", () => {
  render(<CaseHero study={eventread} />);
  const h1 = screen.getByRole("heading", { level: 1 });
  expect(h1).toHaveAttribute("id", "case-title");
  expect(h1).toHaveAttribute("tabindex", "-1");
});

test("hero: the external link opens in a new tab and says so", () => {
  render(<CaseHero study={eventread} />);
  const link = screen.getByRole("link", { name: /Visit site/ });
  expect(link).toHaveAttribute("target", "_blank");
  expect(link).toHaveAttribute("rel", "noreferrer");
  expect(link).toHaveAccessibleName(/^Visit site\s*\(opens in a new tab\)$/);
});

test("hero: no link out when the study has no live site", () => {
  render(<CaseHero study={cyvore} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
