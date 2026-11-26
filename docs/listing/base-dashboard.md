# Base Dashboard Listing (`tap2stacks`)

This guide contains every field and asset required to register **tap2stacks** on the [Base Dashboard](https://base.dev) (`base.dev` / `dashboard.base.org`), verify Builder Code attribution (`bc_ymo2v08a`), and publish for Coinbase Wallet's in-app browser.

> **Status note (`docs.base.org`, 2026):** Base retired MiniKit and Farcaster-style Base Mini Apps. The Base App is Coinbase Wallet again and natively opens standard web apps inside its in-app browser. Discovery, verification, and ERC-8021 traction attribution are managed through the Base Dashboard.

## 1. Listing Fields

| Field | Value | Notes |
| --- | --- | --- |
| **App Name** | `tap2stacks` | Current brand name |
| **Short Description / Tagline** | `Tap live price cells on Base Sepolia testnet.` | Concise, <= 60 chars |
| **Long Description** | `tap2stacks is a real-time price target grid game running on Base Sepolia testnet. Choose a market feed, set a stake in non-monetary test USDC (tUSDC), and tap future 5-second price cells on the live board. Deposits, withdrawals, and faucet claims use Base Sepolia smart contracts with EIP-5792 sponsored calls and verifiable on-chain settlement proofs. Testnet preview only; no real money; 18+ and non-US.` | Clearly discloses testnet/non-monetary status and regional/age gates |
| **Category** | `Games` (or `Gaming / Prediction`) | Matches the Base Dashboard category picker |
| **Tags / Keywords** | `gaming`, `testnet`, `base-sepolia`, `prediction`, `onchain` | Optional discovery tags if prompted |
| **Website / Home URL** | `https://45-77-250-147.sslip.io` | Controlled by `VITE_PUBLIC_URL`; update in both build env and Base Dashboard if moved to a custom domain |
| **Network** | `Base Sepolia` (`84532`) | Testnet preview deployment |
| **Base Builder Code** | `bc_ymo2v08a` | Configured via `VITE_BASE_BUILDER_CODE=bc_ymo2v08a` |
| **ERC-8021 Data Suffix** | `0x62635f796d6f32763038610b0080218021802180218021802180218021` | Generated automatically by `builderCodeSuffix("bc_ymo2v08a")` |
| **Support / Contact** | `<REPLACE_WITH_SUPPORT_EMAIL_OR_URL>` | **Placeholder:** fill in the support email or contact URL before submitting |

## 2. Visual Assets

Brand icon and OpenGraph banner are generated deterministically from SVGs (warm paper, ink, grid, price line, and tap coin — no third-party trademarks) by [`scripts/generate-miniapp-images.mjs`](../../scripts/generate-miniapp-images.mjs):

| Asset | Path | Dimensions & Format | Usage |
| --- | --- | --- | --- |
| **App Icon** | `public/brand/icon.png` (`icon.svg`) | `1024x1024` opaque RGB PNG (no transparency) | Base Dashboard app icon, `<link rel="icon">`, `<link rel="apple-touch-icon">` |
| **OG / Preview Banner** | `public/brand/og.png` (`og.svg`) | `1200x630` RGB PNG | `og:image`, `twitter:image`, Base Dashboard hero/preview |
| **Screenshot 1 (Live Board)** | `docs/listing/screenshots/1-board.png` | `1284x2778` portrait PNG (live site capture) | Live tap grid + stake chips |
| **Screenshot 2 (Wallet)** | `docs/listing/screenshots/2-wallet.png` | `1284x2778` portrait PNG (live site capture) | Base Sepolia testnet wallet, faucet & 1:1 vault |
| **Screenshot 3 (History)** | `docs/listing/screenshots/3-history.png` | `1284x2778` portrait PNG (live site capture) | Tap history & settlement records |

*(Note: the captured `1284x2778` store screenshots live in this repository at `docs/listing/screenshots/` so they are not served as static files under `public/`.)*

To regenerate `public/brand/icon.png` and `public/brand/og.png` using Playwright's headless shell:

```bash
PLAYWRIGHT_BROWSERS_PATH=$HOME/.local/share/ms-playwright node scripts/generate-miniapp-images.mjs
```

## 3. Build Environment Variables

Set these public variables when building for `https://45-77-250-147.sslip.io` (or update `VITE_PUBLIC_URL` when moving to a custom domain):

```env
VITE_PUBLIC_URL=https://45-77-250-147.sslip.io
VITE_BASE_BUILDER_CODE=bc_ymo2v08a
VITE_CHAIN_ID=84532
VITE_RPC_URL=https://sepolia.base.org
```

## 4. Exact Steps to Register & Verify

1. **Deploy the web app** at `https://45-77-250-147.sslip.io` (built with `VITE_PUBLIC_URL=https://45-77-250-147.sslip.io` and `VITE_BASE_BUILDER_CODE=bc_ymo2v08a`). Confirm `https://45-77-250-147.sslip.io/brand/icon.png` and `https://45-77-250-147.sslip.io/brand/og.png` return HTTP 200 and `<meta property="og:image">` in `index.html` points to `https://45-77-250-147.sslip.io/brand/og.png`.
2. **Open the Base Dashboard** at [base.dev](https://www.base.dev) and sign in with the project owner wallet that holds/manages Builder Code `bc_ymo2v08a`.
3. **Verify Builder Code ownership:** Go to **Settings -> Project Settings -> Builder Code** and confirm the active project's code matches `bc_ymo2v08a` (ERC-8021 suffix `0x62635f796d6f32763038610b0080218021802180218021802180218021`). If a new project is created, update `VITE_BASE_BUILDER_CODE` in `.env` and rebuild.
4. **Fill in the App Listing form** using the table in Section 1 above and upload:
   - Icon: `public/brand/icon.png` (`1024x1024`, opaque PNG)
   - Banner (if requested): `public/brand/og.png` (`1200x630`)
   - Screenshots: `docs/listing/screenshots/1-board.png`, `2-wallet.png`, `3-history.png` (`1284x2778`)
   - Support / Contact: replace `<REPLACE_WITH_SUPPORT_EMAIL_OR_URL>` with the support email or contact URL
5. **Verify domain & ownership** if prompted by the Base Dashboard (follow the dashboard's domain ownership check or wallet signature prompt for `45-77-250-147.sslip.io`).
6. **Smoke test inside Coinbase Wallet mobile browser (iPhone 12+ / Android):**
   - Open `https://45-77-250-147.sslip.io` inside Coinbase Wallet's in-app browser.
   - Confirm the wallet picker highlights **Coinbase Wallet (In-app browser wallet)** at the top via EIP-6963 (`com.coinbase.wallet`).
   - Run a faucet claim or deposit on Base Sepolia and verify on `sepolia.basescan.org` that the transaction input calldata ends with `62635f796d6f32763038610b0080218021802180218021802180218021` (and check attribution in Base Dashboard analytics).
   - Confirm top header / bottom nav clear the iOS notch & home bar and left-edge swipe-back still navigates back cleanly.
7. **Submit for review / listing** in the Base Dashboard. Keep the Base Sepolia testnet / non-monetary `Test USDC` ("no real money") framing and the existing 18+ / US geo-block intact; transitioning to real-money mainnet wagering later will require legal/compliance review under Coinbase's Prohibited & Conditional Use Policy and mobile app store rules.
