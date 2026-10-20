import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { OFF } from "@/lib/marni-came/moves";
import { MovesCanvas } from "./moves-canvas";

const D = { box: [0.36, 0, 0.64, 0.62] as [number, number, number, number], dx: 0.15, dy: -0.02, scale: 1.18 };

test("without WebGL the plain image stays and is labelled", () => {
  render(<MovesCanvas src="/a.jpg" alt="Liam half lit" burnSrc="/b.jpg" doubled={D} state={OFF} />);
  expect(screen.getByRole("img", { name: "Liam half lit" })).toBeInTheDocument();
  expect(document.querySelector("[data-fallback='true']")).not.toBeNull();
  expect(document.querySelector("canvas")).toBeNull();
});
