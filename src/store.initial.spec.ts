import { describe, expect, it } from "vitest";
import { useGameStore } from "./store";

describe("useGameStore initial state", () => {
  it("shows no balance until the server reports one", () => {
    const { balance, serverBalance } = useGameStore.getInitialState();
    expect(balance).toBe(0);
    expect(serverBalance).toBe(0);
  });
});
