import React from "react";
import { Outlet } from "react-router-dom";
import { useAccount } from "wagmi";
import { boardCellCenter } from "../board/centers";
import { RunningBar } from "../feed/RunningBar";
import { FxCanvas } from "../fx/FxCanvas";
import { WinBanner } from "../fx/WinBanner";
import { BellPill } from "../pages/BellPill";
import { useRealtime } from "../realtime/useRealtime";
import { useWinWatcher } from "../realtime/winWatcher";
import { useGameStore } from "../store";
import { THEME } from "../ui/theme";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { PhoneHeader } from "./PhoneHeader";
import { useIsPhone } from "./useIsPhone";

export interface LayoutProps {
  runningBar?: React.ReactNode;
  bellSlot?: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ runningBar, bellSlot }) => {
  useRealtime();
  useWinWatcher();
  const { address } = useAccount();
  const ticker = useGameStore((state) => state.ticker);
  const isPhone = useIsPhone();

  return (
    <div
      className={`flex h-[100dvh] w-full flex-col overflow-y-hidden ${isPhone ? "overflow-x-hidden" : "overflow-x-auto"}`}
      style={{
        backgroundColor: THEME.paper,
        color: THEME.ink,
        fontFamily: THEME.font,
      }}
    >
      <div
        className={`flex min-h-0 flex-1 flex-col ${isPhone ? "w-full min-w-0" : "min-w-[1024px]"}`}
      >
        <div
          className={`${isPhone ? "h-7" : "h-8"} shrink-0 overflow-hidden`}
        >
          {runningBar ?? <RunningBar ownAddress={address ?? null} />}
        </div>
        {isPhone ? (
          <PhoneHeader bellSlot={bellSlot ?? <BellPill compact />} />
        ) : (
          <Header bellSlot={bellSlot ?? <BellPill />} />
        )}
        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          <Outlet />
        </main>
        {isPhone ? <BottomNav /> : null}
      </div>
      <FxCanvas viewingTicker={ticker} cellCenter={boardCellCenter} />
      <WinBanner />
    </div>
  );
};
