import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import { useState } from "react";
import { useConnect } from "wagmi";
import { THEME } from "../ui/theme";
import { isDevMode } from "../config/dev";
import { visibleWalletConnectors } from "./connectors";

interface WalletDialogProps {
  open: boolean;
  onClose: () => void;
  address?: string;
  network?: string;
  onDisconnect: () => void;
  onTopUp?: () => void;
  isFunding?: boolean;
}

export function WalletDialog({ open, onClose, address, network, onDisconnect, onTopUp, isFunding }: WalletDialogProps) {
  const { connectors, connectAsync, isPending } = useConnect();
  const [error, setError] = useState("");
  const wallets = visibleWalletConnectors(connectors, typeof window !== "undefined" && "ethereum" in window);
  function close() { setError(""); onClose(); }
  return (
    <Dialog open={open} onClose={close} className="relative z-[100]" style={{ fontFamily: THEME.font }}>
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center">
        <DialogPanel className="w-full max-w-sm rounded-2xl p-5" style={{ background: THEME.paper, color: THEME.ink, border: `2px solid ${THEME.ink}`, boxShadow: `4px 4px 0 ${THEME.ink}` }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-extrabold">{address ? "Your wallet" : "Connect wallet"}</DialogTitle>
            <button type="button" onClick={close} aria-label="Close wallet dialog" className="cursor-pointer rounded px-2 py-1 text-xl leading-none">×</button>
          </div>
          {address ? <div className="space-y-4 text-xs">
            <div><p className="opacity-60">Account</p><p className="mt-1 break-all font-bold">{address}</p></div>
            <div><p className="opacity-60">Network</p><p className="mt-1 font-bold">{network || "Unknown network"}</p></div>
            {onTopUp ? <button type="button" disabled={isFunding} onClick={() => { onTopUp(); close(); }} className="w-full rounded-lg p-3 text-left font-bold disabled:opacity-50" style={{ border: `1.5px solid ${THEME.ink}` }}>{isFunding ? "Funding..." : isDevMode() ? "Add 100 test credits" : "Add 100 test credits (play)"}</button> : null}
            <button type="button" onClick={() => { onDisconnect(); close(); }} className="w-full rounded-lg p-3 text-left font-bold" style={{ border: `1.5px solid ${THEME.ink}`, color: THEME.loss }}>Disconnect</button>
          </div> : <div className="space-y-2">
            {wallets.map((connector) => <button key={connector.uid} type="button" disabled={isPending} onClick={() => {
              setError("");
              void connectAsync({ connector }).then(close).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not connect wallet"));
            }} className="w-full cursor-pointer rounded-lg p-3 text-left text-sm font-bold disabled:opacity-50" style={{ border: `1.5px solid ${THEME.ink}`, background: THEME.paper }}>
              {connector.id === "injected" ? "Browser wallet" : connector.name}
              {connector.id === "baseAccount" ? <span className="mt-1 block text-[10px] font-normal opacity-60">Opens Coinbase to sign in</span> : null}
            </button>)}
            {isPending ? <p className="text-xs">Connecting…</p> : null}
            {error ? <p role="alert" className="break-words text-xs" style={{ color: THEME.loss }}>{error}</p> : null}
          </div>}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
