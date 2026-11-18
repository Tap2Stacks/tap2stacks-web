import { useGameStore } from "../store";

export function useOpenStacksSummary() {
  const stacks = useGameStore((s) => s.stacks);
  const open = Object.values(stacks)
    .map((stack) => ({
      ...stack,
      coins: stack.coins.filter(
        (c) => c.status === "open" || c.status === "pending",
      ),
    }))
    .filter((s) => s.coins.length > 0);
  const count = open.reduce((n, s) => n + s.coins.length, 0);
  const stake = open.reduce(
    (n, s) => n + s.coins.reduce((sum, c) => sum + c.amount, 0),
    0,
  );
  return { open, count, stake };
}
