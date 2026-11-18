import type { CoinStack } from "../board/types";
import { useOpenStacksSummary } from "./useOpenStacks";

function StackRow({ stack }: { stack: CoinStack }) {
  const total = stack.coins.reduce((n, c) => n + c.amount, 0);
  const rate =
    stack.coins.reduce((n, c) => n + c.amount * c.rate, 0) / total;
  const [, start, , lower, upper] = stack.cellId.split(":");
  const cell =
    start && lower && upper
      ? `$${lower}–${upper} · ${new Date(Number(start)).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`
      : `Cell ${stack.cellId}`;
  return (
    <li className="rounded border p-3 text-xs">
      <div className="mb-1 font-bold">
        {stack.ticker} · {stack.coins.length}{" "}
        {stack.coins.length === 1 ? "coin" : "coins"}
      </div>
      <div>
        ${total} · x{rate.toFixed(1)}
      </div>
      <div className="mt-1 text-[10px] opacity-50">{cell}</div>
    </li>
  );
}

export function OpenTapsList({ compact = false }: { compact?: boolean }) {
  const { open, count, stake } = useOpenStacksSummary();

  if (compact) {
    return open.length === 0 ? (
      <p className="px-3 pb-2 text-xs opacity-50">
        Choose a coin, then tap a future cell.
      </p>
    ) : (
      <ul className="max-h-36 space-y-1.5 overflow-auto px-3 pb-2">
        {open.map((stack) => (
          <StackRow key={stack.cellId} stack={stack} />
        ))}
      </ul>
    );
  }

  return (
    <section className="min-h-0 flex-1 overflow-auto">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wider">
        Your open taps
      </h2>
      <p className="mb-4 text-xs opacity-60">
        {count} open taps / ${stake} on the board
      </p>
      {open.length === 0 ? (
        <p className="text-xs opacity-50">
          Choose a coin, then tap a future cell.
        </p>
      ) : (
        <ul className="space-y-2">
          {open.map((stack) => (
            <StackRow key={stack.cellId} stack={stack} />
          ))}
        </ul>
      )}
    </section>
  );
}
