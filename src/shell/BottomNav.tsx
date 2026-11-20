import { Link, useLocation } from "react-router-dom";
import { THEME } from "../ui/theme";

const NAV_ITEMS = [
  { label: "Trade", path: "/trade" },
  { label: "History", path: "/history" },
  { label: "Wallet", path: "/wallet" },
  { label: "Proofs", path: "/proofs" },
] as const;

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Mobile navigation"
      className="flex shrink-0 items-center border-t text-[11px]"
      style={{
        backgroundColor: THEME.paper,
        color: THEME.ink,
        borderColor: "rgba(29, 27, 24, 0.15)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {NAV_ITEMS.map((item) => {
        const active =
          pathname === item.path || (pathname === "/" && item.path === "/trade");
        return (
          <Link
            key={item.path}
            to={item.path}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "flex min-h-11 flex-1 items-center justify-center font-extrabold underline underline-offset-4 opacity-100"
                : "flex min-h-11 flex-1 items-center justify-center font-medium opacity-70"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
