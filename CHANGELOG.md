# Kdawg Keno changes

## 2026-10-11 — Keno-first gaming beta

### Added

Kdawg Keno branding and an interactive 80-number Keno board. Players select 1–5 numbers; 20 distinct balls are drawn and payouts are calculated from actual matches. Quick pick, clear, animated ball reveals, and the gross-return table are included. Free local credits, balance persistence, completed rounds, and personal-best stats make replay possible without an account.

### Fixed

The browser miner previously referenced the DOM helper before initialization, preventing the rest of the arcade from running. A runtime regression test now covers startup. Rounds lock game changes, picks, and wager edits while resolving, and return the stake if interrupted. Simplified Roulette, Slots, and hand-comparison previews now pay from their displayed outcomes instead of unrelated win flags.

### Boundaries

Browser GNC-C credits remain separate from local-chain GNC test tokens. The browser SHA-256 puzzle is opt-in, stoppable, time-limited, and not network mining. RPC and community-board status do not claim to be online without a configured responding API. A shared public leaderboard is not implemented; displayed player stats are local to this device.

The public beta has no cash-out, deposits, exchange trading, or on-chain wager settlement. A local EVM development chain is not a decentralized production GNC mainnet. Existing Render/MongoDB infrastructure must be made healthy separately for shared public services.
