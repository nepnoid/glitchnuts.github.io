# Validation Report

## Validated in this starter build
- Package structure created in repo
- Dry-mode flow is wired end-to-end in code
- Receipt payload hashing implemented with SHA-256
- Receipt bundle writes to `outputs/` as JSON
- Hardhat contract and deploy script included
- `.env.example` documents required values

## Expected dry-run path
1. create task
2. build structured brief
3. simulate Manus result
4. hash payload
5. emit receipt JSON

## Intentionally unset / buyer-supplied
- Gemini live API call
- Manus live API call
- RPC URL
- private key
- chain deployment target
- contract address after deploy

## Why that split exists
The product is meant to be safe to test immediately and adaptable to the buyer's own stack. That means the starter package proves the pattern without bundling live secrets or forcing one chain target.
