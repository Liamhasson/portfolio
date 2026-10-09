import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";
import { pulse } from "@/content/case-studies/pulse";
import { ChallengeList } from "./challenge-list";

test("challenges: labelled section, one item per challenge, three parts each", () => {
  render(<ChallengeList challenges={pulse.challenges} />);
  const section = screen.getByRole("region", { name: "What got in the way" });
  expect(within(section).getByText("Challenges")).toBeInTheDocument();
  const items = within(section).getAllByRole("listitem");
  expect(items).toHaveLength(3);
  expect(within(items[0]).getByRole("heading", { level: 3 })).toHaveTextContent("The Injury Log read as medical advice");
  expect(within(items[0]).getByText(/4 of 6 testers/)).toBeInTheDocument();
});
