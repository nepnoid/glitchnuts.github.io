# Trio Hub Runbook

## 1) Install
```bash
npm install
cp .env.example .env
```

## 2) First dry run
```bash
npm run dry-run
```
Expected result:
- task object prints
- Gemini brief prints
- Manus result prints
- receipt object prints
- JSON receipt bundle is written into `outputs/`

## 3) What buyers can change first
- `src/geminiBridge.js` to swap in a real Gemini call
- `src/manusBridge.js` to swap in a real Manus execution call
- `.env` to set RPC and wallet values

## 4) Compile contract
```bash
npm run compile
```

## 5) Deploy receipt contract
```bash
npm run deploy:receipt
```

## 6) Move from dry to live
Set:
- `DRY_MODE=false`
- `RPC_URL`
- `PRIVATE_KEY`
- `CHAIN_ID`
- `RECEIPT_CONTRACT_ADDRESS`

Then replace the dry adapter throw in `src/manusBridge.js` with the buyer's provider call and add the contract write in the receipt path.

## 7) Product truth
This starter kit proves the orchestration pattern and receipt object flow now.
It does **not** pretend to ship somebody else's live provider credentials or a pre-funded chain setup.
