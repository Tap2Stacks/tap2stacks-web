import React, { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { useRealtime } from "../realtime/useRealtime";
import { THEME } from "../ui/theme";
import { useAccount } from "wagmi";
import { RunningBar } from "../feed/RunningBar";
import { FxCanvas } from "../fx/FxCanvas";
import { WinBanner } from "../fx/WinBanner";
import { useWinWatcher } from "../realtime/winWatcher";
import { boardCellCenter } from "../board/centers";
import { useGameStore } from "../store";
import { BellPill } from "../pages/BellPill";
import { Header } from "./Header";

const MIN_DESKTOP_WIDTH = 1024;

export interface LayoutProps {
  runningBar?: React.ReactNode;
  bellSlot?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ runningBar, bellSlot }) => {
  useRealtime();
  useWinWatcher();
  const { address } = useAccount();
  const ticker = useGameStore(state => state.ticker);

  const [isSmallScreen, setIsSmallScreen] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < MIN_DESKTOP_WIDTH : false,
  );

  useEffect(() => {
    const onResize = () => {
      setIsSmallScreen(window.innerWidth < MIN_DESKTOP_WIDTH);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      className="flex h-screen w-full flex-col overflow-x-auto overflow-y-hidden"
      style={{
        backgroundColor: THEME.paper,
        color: THEME.ink,
        fontFamily: THEME.font,
      }}
    >
      {isSmallScreen ? (
        <div
          role="status"
          className="shrink-0 border-b px-3 py-1.5 text-center text-xs font-bold"
          style={{
            backgroundColor: THEME.highlight,
            color: THEME.ink,
            borderColor: THEME.ink,
          }}
        >
          Best on a bigger screen for now
        </div>
      ) : null}

      <div className="flex min-h-0 min-w-[1024px] flex-1 flex-col">
        <div className="h-8 shrink-0 overflow-hidden">{runningBar ?? <RunningBar ownAddress={address ?? null} />}</div>
        <Header bellSlot={bellSlot ?? <BellPill />} />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </main>
      </div>
      <FxCanvas viewingTicker={ticker} cellCenter={boardCellCenter} />
      <WinBanner />
    </div>
  );
};
