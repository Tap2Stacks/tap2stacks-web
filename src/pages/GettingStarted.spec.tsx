import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GettingStarted } from "./GettingStarted";

beforeEach(() => localStorage.clear());
afterEach(cleanup);
describe("getting started checklist", () => {
  it("remembers completed steps across remounts", () => {
    const { unmount } = render(<GettingStarted />);
    fireEvent.click(screen.getByRole("button", { name: /Getting started/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Tap a cell" }));
    expect(screen.getByText("1/3")).toBeTruthy();
    unmount();
    render(<GettingStarted />);
    expect(screen.getByText("1/3")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Getting started/ }));
    expect((screen.getByRole("checkbox", { name: "Tap a cell" }) as HTMLInputElement).checked).toBe(true);
  });
  it("stays dismissed after reopening", () => {
    const { unmount } = render(<GettingStarted />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss getting started" }));
    unmount();
    render(<GettingStarted />);
    expect(screen.queryByText("Getting started")).toBeNull();
  });
  it("ignores invalid saved data", () => {
    localStorage.setItem("tap2stacks-getting-started", "broken");
    render(<GettingStarted />);
    expect(screen.getByText("0/3")).toBeTruthy();
  });
});
