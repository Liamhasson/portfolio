import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { pulse } from "@/content/case-studies/pulse";
import { CaseStudyPage } from "./case-study-page";

test("the frame in order: hero, at a glance, middle, challenges, outcome, next", () => {
  const Middle = () => <section aria-label="Middle">middle</section>;
  render(<CaseStudyPage study={pulse} Middle={Middle} />);
  const landmarks = screen
    .getAllByRole("region")
    .map((r) => r.getAttribute("aria-label") ?? r.querySelector("h2")?.textContent);
  expect(landmarks).toEqual(["Middle", "What got in the way", "Outcome"]);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Pulse");
  expect(screen.getByRole("link", { name: "Back to projects" })).toHaveAttribute("href", "/#pulse");
  expect(screen.getByRole("link", { name: /Next project: Eventread/ })).toBeInTheDocument();
  expect(document.querySelector("article")).toHaveAttribute("data-world", "pulse");
});
