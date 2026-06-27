# GNC Collaboration Hub Execution Readiness

The hub package is installed and the runtime modules are usable. Full live execution is currently blocked because the live service and chain credentials are not present in the sandbox environment.

| Capability | Current State | Execution Decision |
|---|---|---|
| Gemini structuring | `GEMINI_API_KEY` missing | Live Gemini call cannot run yet. |
| Meli review gate | `MELI_API_URL` missing | Local Meli gate can safely approve or log fallback review. |
| Manus task creation | `MANUS_API_KEY` missing | Live Manus API task creation cannot run yet. |
| GNC on-chain receipt | `GNC_RPC_URL`, `GNC_CHAIN_ID`, wallet, and contract address missing | On-chain writes must remain disabled. |
| Off-chain JSONL log | Local filesystem available | Safe to run and preserve local task/brief/decision/receipt hashes. |

The highest-safe immediate run mode is therefore an **offline/local proof run**. It should create the same shared-state objects, preserve local hashes, pass through the Meli local gate, skip live Manus submission, and skip GNC chain writes until real credentials are supplied.
