import { fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: React.ComponentProps<"a">) => <a href={href} {...rest}>{children}</a> }));

import NotFound from "./not-found";
import ErrorPage from "./error";
import { rootMetadata } from "@/lib/site";
import { metadata as home } from "./page";

test("a wrong address gets the site's own page: what happened, and the way back to the start and to the projects (Liam, 2026-10-13)", () => {
  render(<NotFound />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("This page isn’t here.");
  expect(screen.getByRole("link", { name: "Back to the start" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "See the projects" })).toHaveAttribute("href", "/#projects");
});

test("a page that breaks says so and offers to try again, and the way back", () => {
  const retry = vi.fn();
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(<ErrorPage error={new Error("boom")} retry={retry} />);
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Something broke on this page.");
  fireEvent.click(screen.getByRole("button", { name: "Try again" }));
  expect(retry).toHaveBeenCalled();
  expect(screen.getByRole("link", { name: "Back to the start" })).toHaveAttribute("href", "/");
});

test("only the home page names itself as liamhasson.com: a 404 no longer inherits it", () => {
  expect(rootMetadata.alternates?.canonical).toBeUndefined();
  expect(home.alternates?.canonical).toBe("/");
});
