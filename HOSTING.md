# Vercel preparation (Base Sepolia only)

This is a React 19 + TypeScript + Vite SPA, not Next.js. Backend REST and
Socket.IO already use `VITE_BACKEND_URL` via `src/constant/backend-url.ts`.
Without it they use the page origin (useful behind Vite's local proxy, wrong for
a separately hosted Vercel frontend). Use the backend **origin**, not `/api`.
The existing `vercel.json` already has SPA rewrites, static asset caching and
security headers. `middleware.ts` blocks US requests with `public/blocked.html`.

## One-time setup for an authorized operator

No project, account or deployment was created by this task.

tap2stacks has no project token. Existing TestUSDC/tUSDC settings below are
test collateral already required by the application, not a project token or
new configuration variables. Hosting preparation does not issue any token.

1. Arrange the backend described in `../tap2stacks-backend/HOSTING.md` and obtain verified
   Base Sepolia contract metadata from the contracts operator. The checked-out
   `tap2stacks-contracts/deployments` directory has no deployment JSON yet. Do not invent
   addresses or use mainnet addresses/keys.
2. In https://vercel.com/new import `tap2stacks/tap2stacks-web`. Root directory: `.`;
   framework: Vite; Node.js: 24.x; install: `bun install --frozen-lockfile`;
   build: `bun run build`; output: `dist`. The repo includes `bun.lock`.
   Importing may trigger a deployment, so do this only after explicit approval.
3. Set the following public build-time variables for the intended Production and
   Preview scopes before the first build (and rebuild when any value changes):
   - `VITE_BACKEND_URL=https://<BACKEND_APP>.fly.dev`
   - `VITE_CHAIN_ID=84532`
   - `VITE_RPC_URL=https://sepolia.base.org` (or a public browser-safe testnet RPC)
   - `VITE_TUSDC_ADDRESS=<testUSDC from base-sepolia.json>`
   - `VITE_VAULT_ADDRESS=<vault from base-sepolia.json>`
   - `VITE_PROOF_ANCHOR_ADDRESS=<proofAnchor from base-sepolia.json>`
   - `VITE_BASE_BUILDER_CODE=bc_ymo2v08a` (tap2stacks's registered Base Builder Code; public)
   - `VITE_ENABLE_DEV_TOOLS=false`, `VITE_PREVIEW_TOPUP=false`
   - Optional `VITE_CDP_PROJECT_ID=<public Coinbase CDP project ID>` for email
     wallet support; allowlist the exact web origins in that CDP project.
4. Put exact web origins in the backend's `CORS_ORIGINS`, including specifically
   approved preview URLs if needed. Preserve backend geofencing and leave its
   dev faucet disabled. There is no frontend database to provision.
5. Once a future deployment is authorized, check direct navigation to SPA routes,
   US blocking, wallet login on Base Sepolia, REST and Socket.IO across origins.
   Do not turn on preview top-up on Vercel.

## Local checks and environment inventory

Use Node 24 LTS. Install `bun install --frozen-lockfile`, then `bun run build`,
`bun run test --run`, `bun run lint`. The existing lint suite currently reports
six errors in `AssetLogo.tsx` and `FxCanvas.tsx`, unrelated to hosting changes.
Enable the author hook for commits with `git -c core.hooksPath=.githooks` and
author as nvq2309 <nvq2309@gmail.com>.

`.env.example` lists every custom variable read by the app/config:

| Variable | Required? | Used in | Example |
| --- | --- | --- | --- |
| VITE_BACKEND_URL | Yes on Vercel | constant/index.tsx, api/feed.ts (REST + Socket.IO consumers) | https://YOUR-BACKEND.fly.dev |
| VITE_CHAIN_ID | No; defaults 84532, other chains rejected | config/chains.ts | 84532 |
| VITE_RPC_URL | No; public Base Sepolia default | config/chains.ts | https://sepolia.base.org |
| VITE_TUSDC_ADDRESS | Yes for token flows | contracts/addresses.ts | verified TestUSDC address |
| VITE_VAULT_ADDRESS | Yes for custody flows | contracts/addresses.ts | verified Tap2StacksVault address |
| VITE_PROOF_ANCHOR_ADDRESS | Yes for proof views | contracts/addresses.ts | verified ProofAnchor address |
| VITE_CDP_PROJECT_ID | Optional email wallet | components/Provider.tsx, wallet/WalletDialog.tsx | public CDP project ID |
| VITE_BASE_BUILDER_CODE | Yes on Vercel for Builder Code attribution | lib/builderCode.ts, hooks/useSponsoredCalls.ts | bc_ymo2v08a |
| VITE_ENABLE_DEV_TOOLS | No; only consulted in dev | config/dev.ts | false |
| VITE_PREVIEW_TOPUP | No; false on Vercel | config/dev.ts | false |
| DEV_BACKEND_PROXY | No; local dev server only | vite.config.ts | http://127.0.0.1:5001 |
| DEV | Vite-provided built-in, not user configured | config/dev.ts, WalletView.tsx | false in production |

All frontend variables are public, including RPC URLs; never include private
keys, engine tokens, paymaster credentials or private provider API keys.

Chain settings: chain ID `84532` (`0x14a34`), RPC
`https://sepolia.base.org`, explorer `https://sepolia.basescan.org`.
The wallet provider permits only `baseSepolia`; unsupported chains get no
explorer link. There is no separate bundler URL variable: the connected wallet
handles bundling. Sponsorship uses the backend's `/api/paymaster/t/<token>` URL;
its upstream must be configured for Base Sepolia only. No project-token settings
were introduced.

## Sibling dependencies

No workspace/path dependencies on `tap2stacks-engine` or `tap2stacks-contracts`. The web consumes
engine-derived data through the backend, never the Rust engine directly.
Contract ABIs are committed under `src/contracts/abi`, copied by the contracts
repo's `scripts/export-abi.sh`. That script expects sibling checkout paths but is
not part of web install/build. Regenerate/review them together with backend ABIs
after contract changes; actual addresses must match the same Base Sepolia
deployment as the backend. No new ABI generation or chain actions were run here.
