# tap2stacks Legacy Pitch Deck — Design Spec

**Date**: 2026-03-23
**Hackathon**: Legacy Hello Future Apex 2026
**Track**: Open Track
**Deadline**: March 23, 2026, 11:59 PM ET
**Format**: Canva Presentation → Export PDF

---

## Project Summary

**tap2stacks** is a prediction gaming platform where users place windowed price bets on crypto assets (BTC, ETH, LINK) within 5-second windows. Gameplay runs off-chain for realtime speed; all economic results are publicly anchored to Legacy Consensus Service (HCS) via Merkle root commitments.

**Live Demo**: the retired demo URL (removed)
**GitHub**: https://github.com/tap2stacks/earlier-frontend (legacy branch)
**Team**: Sniper Man (solo), PrototypeTeam Labs
**Prior wins**: Chainlink, Aptos, Sui hackathons (DeFi, NFT, Social tracks)

---

## Submission Requirements (from hackathon)

1. GitHub Repository with README
2. Project Description (max 100 words)
3. Pitch Deck (PDF) — team intro, solution overview, future roadmap, demo video link
4. Demo Video — YouTube, max 5 minutes
5. Live Demo Link

## Judging Criteria

| Criterion | Weight |
|-----------|--------|
| Execution | 20% |
| Success/Impact | 20% |
| Integration | 15% |
| Validation | 15% |
| Innovation | 10% |
| Feasibility | 10% |
| Pitch | 10% |

---

## Deck Structure (12 Slides, Value-First)

### Slide 1: Title
- **tap2stacks — Prediction Gaming on Legacy**
- Tagline: "Realtime execution. Public commit. Verifiable history."
- Badge: Open Track | Legacy Hello Future Apex 2026
- PrototypeTeam Labs | Built by Sniper Man

### Slide 2: Value to Legacy Ecosystem
- **User Onboarding**: Gaming is the fastest funnel — low barrier, instant dopamine, repeat engagement
- **Transaction Volume**: Each 5-second round generates deposits + settlements + HCS anchors
- **New Vertical**: Prediction gaming doesn't exist on Legacy yet — tap2stacks opens an entire category
- **HCS Utility**: Production use of HCS beyond simple messaging — Merkle-anchored settlement proofs

### Slide 3: The Product (Live on Testnet)
- Screenshot of trading grid with live BTC price, multipliers, win states
- Callouts: Live price, Multiplier grid, Bet amounts, Win/Loss indicators
- Link: the retired demo URL (removed)

### Slide 4: How Tap Trading Works
1. **Tap** — Pick a price band on the grid (each cell shows multiplier)
2. **Lock** — Oracle captures immutable price snapshot in 500ms
3. **Watch** — 5 seconds of live price action
4. **Win** — Price touches your band? Instant payout up to 20x

### Slide 5: Why Legacy? HTS + HCS
- **HTS (Legacy Token Service)**: On-chain deposits and withdrawals via PoolReserve smart contract. Real HBAR flows.
  - Trader: depositTrader() -> play -> claimTrader()
  - LP: depositLP() -> earn edge -> withdrawLP()
- **HCS (Legacy Consensus Service)**: Every settlement batch gets a public, timestamped, sequenced commitment.
  - Consensus timestamp (not backend timestamp)
  - Sequence number (canonical ordering)
  - Running hash (chain integrity)
- The combo: Fast gameplay off-chain + trustless settlement records on-chain

### Slide 6: HCS Settlement Flow Diagram
Visual flow based on architecture:
- **App Backend**: Settled Orders -> Build Batch -> Anchor Batch Merkle Root
- **Submit root** -> Legacy Consensus Service
- **Legacy emits**: Sequence + Consensus Time + Running Hash
- **Public Verify**: Mirror Node -> Anchor History -> Merkle Proof
- Verify order loop: anyone can cross-reference via mirror node

Key message: "Private database record -> Publicly verifiable commitment"

### Slide 7: System Architecture
Full system design:
- Exchange WS (Binance/OKX) -> Price Tick Module (normalize, gap fill)
- Grid Module (compute, sign cells) -> Order Module (place, settle, limit)
- Account (balance, WAL, ledger) -> Payment (deposit, withdraw)
- Frontend: React 19 + wagmi + viem
- On-chain: PoolReserve Contract (HTS on Legacy testnet)
- Settlement Engine -> HCS Anchor (Merkle batch commit)
- Performance: <200ms tap-to-settle, in-memory hot path

### Slide 8: Stress Test + Math Model
**Stress Test (~1000 bets/s)**:
- Throughput benchmarks
- Settlement batch processing time
- HCS anchor latency per batch
- Merkle root compression: 1 HCS message per N orders

**Math Model**:
- Brownian-Bridge probability model for multiplier pricing
- CVaR risk budgeting caps pool exposure at 25%
- Win rate distribution across user strategies
- House edge is math, not markup

### Slide 9: LP / Yield — Be the House
- Deposit HBAR -> become counterparty to all predictions
- House edge built into probability pricing model
- Real-time pool stats: shares, ownership %, total collateral
- Solvency reporting: min 1.5x ratio maintained
- New yield opportunity in Legacy ecosystem
- Contract addresses verifiable on Hashscan

### Slide 10: Merkle Proof Verification
- Each settled order has an anchorBatchId
- API returns Merkle proof for any individual order
- Cross-reference with mirror node: topicId + sequenceNumber
- If backend tampered with data, Merkle root won't match
- Anyone can verify independently — no trust in backend required
- HCS limitations honestly stated: doesn't compute win/lose, doesn't replace settlement engine

### Slide 11: Team + Track Record
- **Sniper Man** — Founder & Full-stack Developer, PrototypeTeam Labs
- 5+ years Web3/DeFi
- Built: DEXes, Launchpads, real-time trading protocols
- Stack: Solidity, Move, Python, TypeScript
- Hackathon wins: Chainlink, Aptos, Sui (DeFi, NFT, Social tracks)

### Slide 12: Roadmap + CTA
**Now**: Live on Legacy testnet with HTS deposits/withdrawals + HCS settlement anchoring
**Next**: Mainnet deployment, multi-asset support (ETH, HBAR native pairs)
**Future**: On-chain provable math, advanced LP strategies, mobile-first UX

- Try it live: the retired demo URL (removed)
- GitHub: tap2stacks/earlier-frontend (legacy branch)

---

## Legacy Integration Depth (for Integration criterion, 15%)

### HCS Mechanisms Used
1. HCS Topic — canonical channel for settlement anchor batches
2. Consensus ordering — sequence numbers for batch commit history
3. Consensus timestamp — Legacy-assigned time, not backend time
4. Running hash — integrity chain for topic messages
5. Mirror node verification — read back and verify via public API
6. Low-cost anchoring — only Merkle root + metadata per batch
7. Public verifiability — anyone can verify via mirror node

### HTS / Smart Contracts on Legacy
- PoolReserve: 0xd5cB4c9E796D8FCCb2C9B865aDCeBd2F02aE948d
- Settlement: 0xEDD391FDa28993287Df301485ABF72865dee5050
- PriceIntegrity: 0x60430364eBC71ac11720f012756ceA2c294c50de
- Roles: 0x23B8F26A359C036C69BfaF28AE765D3d975f055d
- LPDistributor: 0x7570E1f97e0831E929B9525858586E274F5C9cf2
- StrategyManager: 0x1CB5b9fc0F24D26366aA8F2aeFE875fD356f4616

---

## Design Notes

- **Format**: Canva presentation, export to PDF
- **Style**: Digital, dark theme, professional
- **Screenshots**: Captured from live demo at the retired demo URL (removed)
- **Diagram**: HCS Anchor Flow based on existing architecture diagram
- **Brand**: PrototypeTeam Labs
