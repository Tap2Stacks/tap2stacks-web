import React from "react";
import { ArrowDownUp, CircleDollarSign, Coins, Droplets, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { AssetLogo } from "./components/AssetLogo";
import { baseSepolia } from "./config/chains";
import { isDevMode } from "./config/dev";
import { ActionButton, StatCard } from "./pages/WalletCards";
import { useWallet } from "./pages/useWallet";
import { formatAmount, formatCompactNumber } from "./pages/walletUtils";
import { THEME } from "./ui/theme";
import { TOKEN_DECIMALS, TOKEN_SYMBOL } from "./utils/chain";

function WalletOverview({
  shortAddress,
  chainName,
  vaultAddress,
  sponsored,
  isConnected,
  chainMismatch,
}: {
  shortAddress: string;
  chainName?: string;
  vaultAddress?: string;
  sponsored: boolean;
  isConnected: boolean;
  chainMismatch: boolean;
}) {
  const rows = [
    { label: "Wallet", value: shortAddress, icon: Wallet },
    { label: "Network", value: chainName ?? "Not connected", icon: CircleDollarSign },
    {
      label: "Vault",
      value: vaultAddress ? `${vaultAddress.slice(0, 8)}...${vaultAddress.slice(-6)}` : "Not set up",
      icon: ShieldCheck,
    },
    {
      label: "Gas",
      value: isConnected ? (sponsored ? "Sponsored" : "You pay gas") : "—",
      icon: Coins,
    },
  ];
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: THEME.paper, border: `1.5px solid ${THEME.ink}`, boxShadow: `0 2px 0 ${THEME.ink}` }}
    >
      <h3 className="text-lg font-semibold text-ink">Wallet Overview</h3>
      <div className="mt-4 space-y-2">
        {rows.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
            style={{ borderColor: THEME.ink, background: THEME.yellow }}
          >
            <span className="inline-flex items-center gap-2 text-xs text-ink/70">
              <Icon size={14} className="text-ink" />
              {label}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink">
              {label === "Network" && chainName ? <AssetLogo symbol={chainName} size={14} /> : null}
              <span>{value}</span>
            </span>
          </div>
        ))}
      </div>
      {chainMismatch ? (
        <p className="mt-3 text-xs text-loss">Wrong network. Switch to {baseSepolia.name}.</p>
      ) : null}
    </div>
  );
}

function FaucetCard({
  contractsReady,
  isConnected,
  chainMismatch,
  isPendingSwitch,
  cooldownSec,
  cooldownLabel,
  pending,
  onClaim,
}: {
  contractsReady: boolean;
  isConnected: boolean;
  chainMismatch: boolean;
  isPendingSwitch: boolean;
  cooldownSec: number;
  cooldownLabel: string;
  pending: boolean;
  onClaim: () => void;
}) {
  const idleLabel = chainMismatch
    ? "Switch to Base Sepolia"
    : !isConnected
      ? "Connect wallet to claim"
      : cooldownSec > 0
        ? `Cooldown ${cooldownLabel}`
        : `Claim 100 ${TOKEN_SYMBOL}`;
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: THEME.paper, border: `1.5px solid ${THEME.ink}`, boxShadow: `0 2px 0 ${THEME.ink}` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/65">Testnet Faucet</p>
          <h3 className="mt-1 text-base font-semibold text-ink">100 {TOKEN_SYMBOL} / 24h</h3>
        </div>
        <Droplets size={18} className="text-ink" />
      </div>
      <div className="mt-4">
        <ActionButton
          variant="secondary"
          onClick={onClaim}
          disabled={!contractsReady || (!chainMismatch && (!isConnected || cooldownSec > 0)) || pending || isPendingSwitch}
          pending={pending || (chainMismatch && isPendingSwitch)}
          pendingLabel={chainMismatch ? "Switching..." : "Claiming..."}
          idleLabel={idleLabel}
        />
      </div>
    </div>
  );
}

function TransferAmountBox(w: ReturnType<typeof useWallet>) {
  const balanceText = w.isDepositFlow
    ? `${formatAmount(w.walletBalanceBase, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`
    : `${formatCompactNumber(w.offChainBalance)} ${TOKEN_SYMBOL}`;
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: THEME.ink, background: THEME.paper }}>
      <div className="flex items-center justify-between text-xs text-ink/70">
        <span>{w.isDepositFlow ? "From Wallet" : "From App Balance"}</span>
        <button
          type="button"
          onClick={w.handleMax}
          className="cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium text-ink"
          style={{ borderColor: THEME.ink, background: THEME.yellow }}
        >
          Max
        </button>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          value={w.amountStr}
          onChange={(e) => w.setAmountStr(e.target.value)}
          placeholder="0"
          className="min-w-0 flex-1 bg-transparent text-left text-3xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink/40"
        />
        <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-semibold" style={{ borderColor: THEME.ink, background: THEME.yellow }}>
          <AssetLogo symbol={TOKEN_SYMBOL} size={14} />
          {TOKEN_SYMBOL}
        </span>
      </div>
      <p className="mt-2 text-xs text-ink/70">Available: {balanceText}</p>
    </div>
  );
}

function TransferForm(w: ReturnType<typeof useWallet>) {
  const actionLabel = w.chainMismatch
    ? "Switch to Base Sepolia"
    : !w.isConnected
      ? "Connect wallet"
      : w.isDepositFlow
        ? `Deposit ${TOKEN_SYMBOL}`
        : `Withdraw ${TOKEN_SYMBOL}`;
  const isBusy = w.pendingAction === "deposit" || w.pendingAction === "withdraw" || (w.chainMismatch && w.isPendingSwitch);
  const disabled = !w.chainMismatch && (!w.isConnected || !w.parsed.valid || w.pendingAction !== null);
  return (
    <div className="mt-4 space-y-3">
      <TransferAmountBox {...w} />
      <div className="flex justify-center">
        <button
          type="button"
          onClick={w.handleToggleDirection}
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl border text-ink"
          style={{ borderColor: THEME.ink, background: THEME.yellow }}
          aria-label="Switch swap direction"
        >
          <ArrowDownUp size={16} />
        </button>
      </div>
      {w.parsed.error ? <p className="text-xs text-loss">{w.parsed.error}</p> : null}
      {!w.sponsored ? <p className="text-xs text-ink/70">You pay gas on this wallet.</p> : null}
      <ActionButton
        onClick={() => void (w.isDepositFlow ? w.handleDeposit() : w.handleWithdraw())}
        disabled={disabled || isBusy}
        pending={isBusy}
        pendingLabel={w.chainMismatch ? "Switching network..." : w.isDepositFlow ? "Depositing..." : "Withdrawing..."}
        idleLabel={actionLabel}
      />
    </div>
  );
}

function TransferCard(w: ReturnType<typeof useWallet>) {
  return (
    <div
      className="h-fit rounded-xl p-5 lg:sticky lg:top-5"
      style={{ background: THEME.paper, border: `1.5px solid ${THEME.ink}`, boxShadow: `0 2px 0 ${THEME.ink}` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-ink/70">Transfer (1:1)</p>
          <h2 className="mt-1 text-lg font-semibold text-ink">
            {w.isDepositFlow ? "Wallet → App balance" : "App balance → Wallet"}
          </h2>
        </div>
        <span className="rounded-md border px-2 py-1 text-xs text-ink" style={{ borderColor: THEME.ink, background: THEME.yellow }}>
          {w.isConnected ? "Connected" : "Offline"}
        </span>
      </div>

      {!w.contracts ? (
        <div className="mt-4 rounded-xl border p-6 text-center" style={{ borderColor: THEME.ink, background: THEME.paper }}>
          <p className="text-sm font-semibold text-ink">On-chain wallet not set up yet</p>
          <p className="mt-1.5 text-xs text-ink/70">
            Contract addresses are not configured.
            {import.meta.env.DEV && isDevMode() ? " Use the dev top-up button in the header for local testing." : ""}
          </p>
        </div>
      ) : (
        <TransferForm {...w} />
      )}
    </div>
  );
}

export const WalletView: React.FC = () => {
  const w = useWallet();
  return (
    <div className="relative mx-auto flex w-full min-w-0 max-w-7xl flex-1 flex-col gap-4 px-3 py-4 sm:px-6 lg:px-10 lg:py-7">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full border" style={{ borderColor: THEME.ink, background: THEME.yellow }}>
            <Wallet size={18} className="text-ink" />
          </div>
          <div>
            <h1 className="text-[1.72rem] font-bold tracking-[-0.03em] text-ink">Wallet</h1>
            <p className="text-xs text-ink/70">Claim test USDC, deposit to vault, or withdraw with permit</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink/70">
          <span className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5" style={{ borderColor: THEME.ink, background: THEME.yellow }}>
            <AssetLogo symbol="Base" size={14} />
            {baseSepolia.name}
          </span>
          <button
            type="button"
            onClick={w.refreshAll}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-ink"
            style={{ borderColor: THEME.ink, background: THEME.yellow }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <StatCard
          label={`Wallet ${TOKEN_SYMBOL}`}
          value={`${formatAmount(w.walletBalanceBase, TOKEN_DECIMALS)} ${TOKEN_SYMBOL}`}
          sub="On-chain Base Sepolia"
        />
        <StatCard
          label="App Balance"
          value={`${formatCompactNumber(w.offChainBalance)} ${TOKEN_SYMBOL}`}
          sub="Available to trade or withdraw"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="min-w-0 space-y-4">
          <WalletOverview
            shortAddress={w.shortAddress}
            chainName={w.chain?.name}
            vaultAddress={w.contracts?.vault}
            sponsored={w.sponsored}
            isConnected={w.isConnected}
            chainMismatch={w.chainMismatch}
          />
          {w.contracts ? (
            <FaucetCard
              contractsReady={Boolean(w.contracts)}
              isConnected={w.isConnected}
              chainMismatch={w.chainMismatch}
              isPendingSwitch={w.isPendingSwitch}
              cooldownSec={w.cooldownSec}
              cooldownLabel={w.cooldownLabel}
              pending={w.pendingAction === "faucet"}
              onClaim={() => void w.handleFaucet()}
            />
          ) : null}
        </div>
        <TransferCard {...w} />
      </section>
    </div>
  );
};
