import { useEffect } from "react";
import { useGameStore } from "../store";
import { THEME } from "../ui/theme";

const stakes = [1, 5, 10, 25];

export function StakeChips({
  shake = false,
  compact = false,
}: {
  shake?: boolean;
  compact?: boolean;
}) {
  const amount = useGameStore((s) => s.betAmount);
  const select = useGameStore((s) => s.setBetAmount);

  useEffect(() => {
    const keydown = (e: KeyboardEvent) => {
      const target = e.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.closest('input,textarea,select,[role="textbox"]'))
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const index = Number(e.key) - 1;
      if (Number.isInteger(index) && index >= 0 && index < 4) {
        select(stakes[index]);
      }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [select]);

  return (
    <div
      aria-label="Stake chips"
      className={`flex ${compact ? "w-full justify-around px-3 py-1" : "gap-3"} ${shake ? "fx-shake" : ""}`}
    >
      {stakes.map((stake, i) => (
        <button
          key={stake}
          aria-label={`Stake $${stake}`}
          aria-pressed={amount === stake}
          onClick={() => select(stake)}
          className={`relative cursor-pointer rounded-full border-2 font-bold ${compact ? "h-12 w-12 text-xs" : "h-14 w-14"}`}
          style={{
            borderColor: THEME.ink,
            background: `linear-gradient(${THEME.coinLight},${THEME.coinDark})`,
            transform: amount === stake ? `translateY(${compact ? "-3px" : "-5px"})` : "none",
            boxShadow: amount === stake ? `0 4px 0 ${THEME.ink}` : "none",
          }}
        >
          ${stake}
          {!compact ? (
            <span className="absolute -bottom-5 left-0 w-full text-[10px] opacity-50">
              {i + 1}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
