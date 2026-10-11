import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { cyvore } from "@/content/case-studies/cyvore";
import { eventread } from "@/content/case-studies/eventread";
import { AtAGlance } from "./at-a-glance";

test("at a glance: four fields in order, plus type when given", () => {
  render(<AtAGlance data={cyvore.atAGlance} />);
  const terms = screen.getAllByRole("term").map((t) => t.textContent);
  expect(terms).toEqual(["Role", "Timeline", "Team", "Tools", "Type"]);
  // The board runs the tools as a list (dots drawn by CSS), one item each.
  expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Figma", "Figma MCP", "Claude Code"]);
});

test("at a glance: no Type term when the study has none, and each value sits under its own term", () => {
  render(<AtAGlance data={eventread.atAGlance} />);
  const terms = screen.getAllByRole("term").map((t) => t.textContent);
  expect(terms).toEqual(["Role", "Timeline", "Team", "Tools"]);
  expect(screen.queryByText("Type")).not.toBeInTheDocument();

  const { role, timeline, team, tools } = eventread.atAGlance;
  const expected: Record<string, string> = {
    Role: role,
    Timeline: timeline,
    Team: team,
    Tools: tools.join(""),
  };
  for (const [term, value] of Object.entries(expected)) {
    const dt = screen.getByText(term, { selector: "dt" });
    expect(dt.nextElementSibling?.tagName).toBe("DD");
    expect(dt.nextElementSibling).toHaveTextContent(value);
  }
});
