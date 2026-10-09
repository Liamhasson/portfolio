import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { cyvore } from "@/content/case-studies/cyvore";
import { AtAGlance } from "./at-a-glance";

test("at a glance: four fields in order, plus type when given", () => {
  render(<AtAGlance data={cyvore.atAGlance} />);
  const terms = screen.getAllByRole("term").map((t) => t.textContent);
  expect(terms).toEqual(["Role", "Timeline", "Team", "Tools", "Type"]);
  expect(screen.getByText("Figma · Figma MCP · Claude Code")).toBeInTheDocument();
});
