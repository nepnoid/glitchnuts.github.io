# GNC Trio Hub Starter Kit

A small working coordination layer for **Gemini -> Manus -> GNC receipts**.

## What is real in this package
- Dry-mode orchestration works out of the box
- Receipt objects are generated and hashed locally
- Canonical task / brief / result / receipt shapes are defined
- Hardhat contract + deploy script are included
- Live chain values are intentionally left blank until the buyer wires their own chain and keys

## Folder map
- `src/geminiBridge.js` - normalizes rough input into a task brief
- `src/manusBridge.js` - simulates or forwards execution
- `src/receiptPipeline.js` - emits receipt objects and hashes
- `src/schemas.js` - canonical object factories
- `scripts/dry-run.js` - one-command end-to-end demo
- `contracts/TrioReceiptRegistry.sol` - minimal receipt registry contract
- `scripts/deploy-receipt.js` - deploys the contract through Hardhat
- `.env.example` - required variables
- `runbook.md` - setup from zero to first receipt
- `validation-report.md` - what was tested and what still needs live values

## Quick start
```bash
npm install
cp .env.example .env
npm run dry-run
```

## What dry mode does
Dry mode runs the full handoff locally:
1. rough task input
2. Gemini bridge shapes it into a brief
3. Manus bridge returns a normalized result
4. receipt pipeline emits signed-ish proof objects with hashes
5. output is written to `outputs/`

Nothing is broadcast on-chain in dry mode.

## What is still required for live chain writes
- funded EVM wallet
- RPC URL
- chain id
- contract deployment
- provider adapters / real API calls for Gemini and Manus

That split is intentional. The starter kit proves the coordination path first, then the buyer drops in live credentials.
