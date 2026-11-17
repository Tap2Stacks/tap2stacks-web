import React from "react";
import { ArrowDownUp, CircleDollarSign, Coins, Droplets, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { baseSepolia } from "./config/chains";
import { TOKEN_DECIMALS, TOKEN_SYMBOL } from "./utils/chain";
import { THEME } from "./ui/theme";
import { ActionButton, StatCard } from "./pages/WalletCards";
import { useWallet } from "./pages/useWallet";
import { formatAmount, formatCompactNumber } from "./pages/walletUtils";

const IN_APP_PER_TOKEN = 10;
const NATIVE_SYMBOL = TOKEN_SYMBOL;
const NATIVE_DECIMALS = TOKEN_DECIMALS;
const ACCENT = THEME.ink;
const ACCENT_SOFT = THEME.yellow;
const BORDER = THEME.ink;
const PANEL_BG = THEME.paper;
const SUBTLE_BG = THEME.yellow;

export const WalletView: React.FC = () => {
  const {
    contracts, isConnected, chain, switchChainAsync,
    isPendingSwitch, activeTab, setDepositAmountStr, setWithdrawInAppStr,
    nativeBalance, offChainBalance, isValidDepositAmount, isValidWithdrawAmount,
    refreshAll, handleDeposit, handleWithdraw, handleMaxDeposit,
    handleMaxWithdraw, chainMismatch, isInsufficientDeposit, isInsufficientWithdraw,
    depositPending, withdrawPending, isDepositFlow, fromAmount,
    toAmount, fromAsset, toAsset, fromAssetBalance,
    toAssetBalance, activeRailLabel, handleToggleDirection, shortAddress,
  } = useWallet();
  return (
    <div className="relative mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-5 sm:px-6 lg:px-10 lg:py-7">

      <section className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-full border"
            style={{
              borderColor: THEME.ink,
              background: ACCENT_SOFT,
            }}
          >
            <Droplets size={18} style={{ color: ACCENT }} />
          </div>
          <div>
            <h1 className="text-[1.72rem] font-bold tracking-[-0.03em] text-ink">
              Wallet Liquidity
            </h1>
            <p className="text-xs text-ink/70">
              Deposit and withdraw between wallet and in-app balance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-ink/70">
          <span
            className="rounded-md border px-2.5 py-1.5"
            style={{ borderColor: BORDER, background: SUBTLE_BG }}
          >
            {baseSepolia.name}
          </span>
          <button
            type="button"
            onClick={refreshAll}
            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-ink transition hover:text-ink"
            style={{ borderColor: BORDER, background: SUBTLE_BG }}
          >
            <RefreshCw size={12} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="On-Chain Balance"
          value={`${formatAmount(nativeBalance?.value, NATIVE_DECIMALS)} ${NATIVE_SYMBOL}`}
          sub="Native wallet balance"
        />
        <StatCard
          label="App Balance"
          value={formatCompactNumber(offChainBalance, 0)}
          sub="Available in app"
        />
        <StatCard
          label="Conversion"
          value={`1 ${NATIVE_SYMBOL} = ${IN_APP_PER_TOKEN.toLocaleString()} APP`}
          sub={activeRailLabel}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <div
            className="rounded-xl p-5"
            style={{
              background: PANEL_BG,
              border: `1.5px solid ${BORDER}`,
              boxShadow: `0 2px 0 ${THEME.ink}`,
            }}
          >
            <h3 className="text-lg font-semibold text-ink">
              Wallet Overview
            </h3>
            <div className="mt-4 space-y-2">
              {[
                { label: "Wallet", value: shortAddress, icon: Wallet },
                {
                  label: "Current Network",
                  value: chain?.name ?? "Unknown",
                  icon: CircleDollarSign,
                },
                {
                  label: "Reserve Contract",
                  value: contracts
                    ? `${contracts.vault.slice(0, 8)}...${contracts.vault.slice(-6)}`
                    : "Not deployed",
                  icon: ShieldCheck,
                },
                { label: "Current Rail", value: activeRailLabel, icon: Coins },
              ].map(({ label, value, icon: Icon }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                  style={{ borderColor: BORDER, background: SUBTLE_BG }}
                >
                  <span className="inline-flex items-center gap-2 text-xs text-ink/70">
                    <Icon size={14} style={{ color: ACCENT }} />
                    {label}
                  </span>
                  <span className="text-xs text-ink">{value}</span>
                </div>
              ))}
            </div>
            {chainMismatch ? (
              <p className="mt-3 text-xs text-loss">
                Wrong network. Please switch to {baseSepolia.name}.
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="h-fit rounded-xl p-5 lg:sticky lg:top-5"
          style={{
            background: PANEL_BG,
            border: `1.5px solid ${BORDER}`,
            boxShadow: `0 2px 0 ${THEME.ink}`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ink">
                Swap
              </p>
              <h2 className="mt-1 text-lg font-semibold text-ink">
                {activeRailLabel}
              </h2>
            </div>
            <div
              className="rounded-md border px-2 py-1 text-xs text-ink"
              style={{ borderColor: BORDER, background: SUBTLE_BG }}
            >
              {isConnected ? "Connected" : "Offline"}
            </div>
          </div>

          {!contracts ? (
            <div
              className="mt-4 rounded-xl border p-6 text-center"
              style={{
                borderColor: BORDER,
                background: THEME.paper,
              }}
            >
              <p className="text-sm font-semibold text-ink">
                Contracts not deployed yet
              </p>
              <p className="mt-1.5 text-xs text-ink/70">
                On-chain deposit and withdrawal forms will appear once contract
                addresses are configured. Use the dev top-up button in the
                header for local testing.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-4 space-y-2">
                <div
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: BORDER,
                    background: THEME.paper,
                  }}
                >
                  <div className="flex items-center justify-between text-xs text-ink/70">
                    <span>From</span>
                    <button
                      type="button"
                      onClick={
                        isDepositFlow ? handleMaxDeposit : handleMaxWithdraw
                      }
                      className="rounded-md border px-2 py-1 text-[11px] font-medium text-ink transition hover:text-ink"
                      style={{ borderColor: BORDER, background: SUBTLE_BG }}
                    >
                      Max
                    </button>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step={isDepositFlow ? "0.001" : "1"}
                      value={fromAmount}
                      onChange={(event) =>
                        isDepositFlow
                          ? setDepositAmountStr(event.target.value)
                          : setWithdrawInAppStr(event.target.value)
                      }
                      placeholder="0"
                      className="min-w-0 flex-1 bg-transparent text-left text-3xl font-semibold tracking-tight text-ink outline-none placeholder:text-ink"
                    />
                    <span
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold"
                      style={{ borderColor: BORDER, background: SUBTLE_BG }}
                    >
                      {isDepositFlow ? (
                        <Wallet size={13} style={{ color: ACCENT }} />
                      ) : (
                        <Coins size={13} style={{ color: ACCENT }} />
                      )}
                      {fromAsset}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-ink/70">
                    Balance: {fromAssetBalance}
                  </p>
                </div>

                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleToggleDirection}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border text-ink transition hover:text-ink"
                    style={{ borderColor: BORDER, background: SUBTLE_BG }}
                    aria-label="Switch swap direction"
                  >
                    <ArrowDownUp size={16} />
                  </button>
                </div>

                <div
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: BORDER,
                    background: THEME.paper,
                  }}
                >
                  <div className="flex items-center justify-between text-xs text-ink/70">
                    <span>To (Estimated)</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <p className="text-3xl font-semibold tracking-tight text-ink">
                      {toAmount}
                    </p>
                    <span
                      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold"
                      style={{ borderColor: BORDER, background: SUBTLE_BG }}
                    >
                      {isDepositFlow ? (
                        <Coins size={13} style={{ color: ACCENT }} />
                      ) : (
                        <Wallet size={13} style={{ color: ACCENT }} />
                      )}
                      {toAsset}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-ink/70">
                    Balance: {toAssetBalance}
                  </p>
                </div>
              </div>

              {activeTab === "deposit" && isInsufficientDeposit ? (
                <p className="mt-3 text-right text-xs text-loss">
                  Deposit amount exceeds connected wallet balance.
                </p>
              ) : null}
              {activeTab === "withdraw" && isInsufficientWithdraw ? (
                <p className="mt-3 text-right text-xs text-loss">
                  Requested amount exceeds your in-app balance.
                </p>
              ) : null}

              <div className="mt-4">
                {chainMismatch ? (
                  <ActionButton
                    onClick={() =>
                      void switchChainAsync?.({ chainId: baseSepolia.id })
                    }
                    disabled={isPendingSwitch}
                    pending={isPendingSwitch}
                    pendingLabel="SWITCHING NETWORK"
                    idleLabel={`SWITCH TO ${baseSepolia.name.toUpperCase()}`}
                  />
                ) : activeTab === "deposit" ? (
                  <ActionButton
                    onClick={handleDeposit}
                    disabled={
                      !isConnected ||
                      depositPending ||
                      !isValidDepositAmount ||
                      isInsufficientDeposit
                    }
                    pending={depositPending}
                    pendingLabel="PROCESSING DEPOSIT"
                    idleLabel={
                      isConnected
                        ? `DEPOSIT ${NATIVE_SYMBOL}`
                        : "CONNECT WALLET TO DEPOSIT"
                    }
                  />
                ) : (
                  <ActionButton
                    onClick={handleWithdraw}
                    disabled={
                      !isConnected ||
                      withdrawPending ||
                      !isValidWithdrawAmount ||
                      isInsufficientWithdraw
                    }
                    pending={withdrawPending}
                    pendingLabel="PROCESSING WITHDRAWAL"
                    idleLabel={
                      isConnected
                        ? `WITHDRAW ${NATIVE_SYMBOL}`
                        : "CONNECT WALLET TO WITHDRAW"
                    }
                  />
                )}
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
};
