import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { MiddleBlock } from "./middle-block";

test("a middle block is a region named by its heading", () => {
  render(
    <MiddleBlock kind="problem" title="Two bands, one lost night">
      <p>Body</p>
    </MiddleBlock>,
  );
  const region = screen.getByRole("region", { name: "Two bands, one lost night" });
  expect(region).toHaveAttribute("data-block", "problem");
});
