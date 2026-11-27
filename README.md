# tap2stacks web

The player app for **tap2stacks**, a tap-to-predict game on live stock prices, built on Base.

Pick a stock (NVDA, TSLA), watch the live chart and tap a cell on the grid: a price row and a 5-second window. If the price touches that row during the window, the tap pays its multiplier. Stakes are test USDC on Base Sepolia; every settled tap can be checked against a Merkle root anchored on-chain.

Live (Base Sepolia testnet): <https://tap2stacks.vercel.app>

| Repo | Role |
|---|---|
| **tap2stacks-web** | Player app (this repo) |
| [tap2stacks-backend](https://github.com/Tap2Stacks/tap2stacks-backend) | Accounts, taps, settlement, proofs, on-chain money flows |
| [tap2stacks-engine](https://github.com/Tap2Stacks/tap2stacks-engine) | Price feed, odds model, quote stream |
| [tap2stacks-contracts](https://github.com/Tap2Stacks/tap2stacks-contracts) | Vault, test USDC and proof anchor on Base Sepolia |

## Features

- **Live board.** A canvas price chart with the quote grid, at 10 updates per second over Socket.IO. It supports zoom and pan, shows five minutes of history, and greys out windows that have already closed.
- **Wallets.** Base Account and any EIP-6963 browser wallet through wagmi, plus an email one-time-code wallet from Coinbase CDP (enabled when `VITE_CDP_PROJECT_ID` is set).
- **Money flows.** Claim test USDC from the faucet, deposit into the vault, and withdraw with a backend-signed EIP-712 permit. Gas is sponsored through a paymaster when available, with a fallback to the player paying gas.
- **History and proofs.** Every settled tap links to its Merkle proof and the on-chain anchor transaction.
- **Attribution.** The Base Builder Code is attached to every app transaction.
- Phone and desktop layouts, a "How it works" guide, and a compliance gate.

## Run

[Bun](https://bun.sh) (lockfile `bun.lock`), React 19, Vite, TypeScript.

```sh
bun install
cp .env.example .env.local   # then fill in the values
bun run dev                  # local dev server; proxies /api and /socket.io to DEV_BACKEND_PROXY
bun run test                 # vitest
bun run build                # type-check and production build
```

| Variable | Meaning |
|---|---|
| `VITE_PUBLIC_URL` | Public site origin (Open Graph tags) |
| `VITE_BACKEND_URL` | Backend origin when hosted separately (empty = same origin) |
| `VITE_CHAIN_ID`, `VITE_RPC_URL` | Base Sepolia (`84532`) and its RPC |
| `VITE_TUSDC_ADDRESS`, `VITE_VAULT_ADDRESS`, `VITE_PROOF_ANCHOR_ADDRESS` | Contract addresses (see tap2stacks-contracts) |
| `VITE_CDP_PROJECT_ID` | Optional Coinbase CDP project for the email wallet |
| `VITE_BASE_BUILDER_CODE` | Base Builder Code for transaction attribution |
| `DEV_BACKEND_PROXY` | Local dev only: backend to proxy to |

All `VITE_*` values are public and embedded at build time; never put secrets in them. Hosting notes are in [`HOSTING.md`](HOSTING.md) (static build, `vercel.json` included).

## Repository rules

Commits use the project identity and are checked by hooks and CI. See [`AGENTS.md`](AGENTS.md).
