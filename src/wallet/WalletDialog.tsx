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
  chainId?: number;
  onDisconnect: () => void;
  onTopUp?: () => void;
  isFunding?: boolean;
}

export function WalletDialog({ open, onClose, address, network, chainId, onDisconnect, onTopUp, isFunding }: WalletDialogProps) {
  const { connectors, connectAsync, isPending } = useConnect();
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [emailMode, setEmailMode] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [flowId, setFlowId] = useState("");
  const [busy, setBusy] = useState(false);
  const [emailApi, setEmailApi] = useState<Awaited<ReturnType<typeof import("./emailRuntime").startEmailWallet>>>();
  const emailConnector = connectors.find((connector) => connector.id === "cdpEmail");
  const projectId = import.meta.env.VITE_CDP_PROJECT_ID?.trim();
  const explorer = chainId === 8453 ? "https://basescan.org" : chainId === 84532 ? "https://sepolia.basescan.org" : undefined;
  const wallets = visibleWalletConnectors(connectors, typeof window !== "undefined" && "ethereum" in window);
  function close() { setError(""); setCopied(false); setEmailMode(false); setEmail(""); setOtp(""); setFlowId(""); setEmailApi(undefined); onClose(); }
  async function openEmail() {
    if (!projectId || !emailConnector) return;
    setBusy(true); setError("");
    try {
      const { startEmailWallet } = await import("./emailRuntime");
      const api = await startEmailWallet(projectId);
      setEmailApi(api);
      if (api.currentUser) { await connectAsync({ connector: emailConnector }); close(); }
      else setEmailMode(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not start email sign-in"); }
    finally { setBusy(false); }
  }
  async function submitEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!emailApi || !emailConnector) return;
    setBusy(true); setError("");
    try {
      if (!flowId) { const result = await emailApi.sendCode(email.trim()); setFlowId(result.flowId); }
      else { await emailApi.verifyCode(flowId, otp.trim()); await connectAsync({ connector: emailConnector }); close(); }
    } catch (err) { setError(err instanceof Error ? err.message : "Email sign-in failed"); }
    finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onClose={() => { if (!busy && !isPending) close(); }} className="relative z-[100]" style={{ fontFamily: THEME.font }}>
      <div className="fixed inset-0 bg-black/50" aria-hidden="true" />
      <div className="fixed inset-0 flex items-end justify-center p-3 sm:items-center">
        <DialogPanel className="w-full max-w-sm rounded-2xl p-5" style={{ background: THEME.paper, color: THEME.ink, border: `2px solid ${THEME.ink}`, boxShadow: `4px 4px 0 ${THEME.ink}` }}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <DialogTitle className="text-base font-extrabold">{address ? "Your wallet" : "Connect wallet"}</DialogTitle>
            <button type="button" onClick={close} disabled={busy || isPending} aria-label="Close wallet dialog" className="cursor-pointer rounded px-2 py-1 text-xl leading-none">×</button>
          </div>
          {address ? <div className="space-y-4 text-xs">
            <div><p className="opacity-60">Account</p><p className="mt-1 break-all font-bold">{address}</p></div>
            <div><p className="opacity-60">Network</p><p className="mt-1 font-bold">{network || "Unknown network"}</p></div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { if (!navigator.clipboard) { setError("Could not copy address"); return; } void navigator.clipboard.writeText(address).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }).catch(() => setError("Could not copy address")); }} className="rounded-lg px-3 py-2 font-bold" style={{ border: `1.5px solid ${THEME.ink}` }}>{copied ? "Copied" : "Copy address"}</button>
              {explorer ? <a href={`${explorer}/address/${address}`} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 font-bold" style={{ border: `1.5px solid ${THEME.ink}` }}>View on explorer</a> : null}
            </div>
            {error ? <p role="alert" style={{ color: THEME.loss }}>{error}</p> : null}
            {onTopUp ? <button type="button" disabled={isFunding} onClick={() => { onTopUp(); close(); }} className="w-full rounded-lg p-3 text-left font-bold disabled:opacity-50" style={{ border: `1.5px solid ${THEME.ink}` }}>{isFunding ? "Funding..." : isDevMode() ? "Add 100 test credits" : "Add 100 test credits (play)"}</button> : null}
            <button type="button" onClick={() => { onDisconnect(); close(); }} className="w-full rounded-lg p-3 text-left font-bold" style={{ border: `1.5px solid ${THEME.ink}`, color: THEME.loss }}>Disconnect</button>
          </div> : emailMode ? <form onSubmit={(event) => void submitEmail(event)} className="space-y-3">
            <label className="block text-xs font-bold" htmlFor="email-wallet-input">{flowId ? `Code sent to ${email}` : "Email address"}</label>
            <input id="email-wallet-input" type={flowId ? "text" : "email"} inputMode={flowId ? "numeric" : "email"} autoComplete={flowId ? "one-time-code" : "email"} value={flowId ? otp : email} onChange={(event) => flowId ? setOtp(event.target.value) : setEmail(event.target.value)} required className="w-full rounded-lg p-3 text-sm" style={{ border: `1.5px solid ${THEME.ink}`, background: THEME.paper }} />
            <button type="submit" disabled={busy} className="w-full rounded-lg p-3 text-sm font-bold disabled:opacity-50" style={{ background: THEME.highlight, border: `1.5px solid ${THEME.ink}` }}>{busy ? "Please wait…" : flowId ? "Verify code" : "Send code"}</button>
            <button type="button" disabled={busy} onClick={() => { setEmailMode(false); setFlowId(""); setError(""); }} className="text-xs underline">Back to wallets</button>
            {error ? <p role="alert" className="break-words text-xs" style={{ color: THEME.loss }}>{error}</p> : null}
          </form> : <div className="space-y-2">
            {projectId && emailConnector ? <button type="button" disabled={busy} onClick={() => void openEmail()} className="w-full cursor-pointer rounded-lg p-3 text-left text-sm font-bold disabled:opacity-50" style={{ border: `1.5px solid ${THEME.ink}`, background: THEME.paper }}>Continue with email</button> : null}
            {wallets.map((connector) => <button key={connector.uid} type="button" disabled={isPending} onClick={() => {
              setError("");
              void connectAsync({ connector }).then(close).catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not connect wallet"));
            }} className="w-full cursor-pointer rounded-lg p-3 text-left text-sm font-bold disabled:opacity-50" style={{ border: `1.5px solid ${THEME.ink}`, background: THEME.paper }}>
              {connector.id === "injected" ? "Browser wallet" : connector.name}
              {connector.id === "baseAccount" ? <span className="mt-1 block text-[10px] font-normal opacity-60">Opens Coinbase to sign in</span> : null}
            </button>)}
            {isPending || busy ? <p className="text-xs">Connecting…</p> : null}
            {error ? <p role="alert" className="break-words text-xs" style={{ color: THEME.loss }}>{error}</p> : null}
          </div>}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
