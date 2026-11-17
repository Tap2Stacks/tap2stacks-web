import { RefreshCw } from "lucide-react";
import { THEME } from "../ui/theme";

const BORDER = THEME.ink;
const TILE_BG = THEME.paper;

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
}

interface ActionButtonProps {
  disabled?: boolean;
  onClick: () => void;
  pending?: boolean;
  pendingLabel: string;
  idleLabel: string;
  variant?: "primary" | "secondary";
}

export function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-xl p-5"
      style={{
        background: TILE_BG,
        border: `1.5px solid ${BORDER}`,
        boxShadow: `0 2px 0 ${THEME.ink}`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: THEME.highlight }}
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/65">
        {label}
      </p>
      <p className="mt-2 text-[1.65rem] font-bold tracking-[-0.04em] text-ink">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-xs text-ink/70">{sub}</p> : null}
    </div>
  );
}

export function ActionButton({
  disabled,
  onClick,
  pending,
  pendingLabel,
  idleLabel,
  variant = "primary",
}: ActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold tracking-wide text-ink transition duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
      style={{
        background: variant === "primary" ? THEME.highlight : THEME.yellow,
        border: `1.5px solid ${BORDER}`,
        boxShadow: `0 2px 0 ${THEME.ink}`,
      }}
    >
      {pending && <RefreshCw size={15} className="animate-spin" />}
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
