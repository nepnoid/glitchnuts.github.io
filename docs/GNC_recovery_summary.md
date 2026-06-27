# GNC Blockchain Recovery Summary

**Author:** Manus AI  
**Date:** 2026-06-19  
**Scope:** Recovered GNC project artifacts from the local workspace and Google Drive, then identified what can be used for a Gemini-Manus collaboration hub.

## Bottom line

The recovered project is clearly the **GNC / Gaming Network Coin blockchain project**. The available documents describe GNC as a sovereign **Avalanche L1 / Subnet-EVM** network with EVM compatibility, validator operations, node bootstrap scripts, monitoring runbooks, and backend integration stubs. This is enough to design the collaboration hub around GNC as the intended chain foundation.

However, the artifacts I recovered still contain unresolved launch placeholders for the real **Subnet ID**, **Blockchain ID**, **VMID**, bootstrap node IDs/IPs, validator identities, and treasury addresses. Based on the available files, I can verify that GNC was architected and packaged for launch, but I cannot yet verify a final live RPC endpoint or final deployed chain identifiers from the recovered artifacts alone.

## Recovered GNC identity

| Item | Recovered value |
|---|---|
| Project name | GNC / Gaming Network Coin / Glitchnut ecosystem |
| Network type | Avalanche L1 / Subnet-EVM |
| Execution model | EVM-compatible, Solidity-compatible |
| Native ticker | GNC |
| Decimals | 18 |
| Intended total supply | 1,000,000,000 GNC |
| Intended launch validator set | 5 validators, permissioned at launch |
| Intended block time | 2 seconds target |
| Status shown in due-diligence file | Architecture and scaffolding complete; key ceremony and infrastructure provisioning still required |

## Key recovered files

| File | What it proves |
|---|---|
| `GNC_Due_Diligence_Report.md` | Defines GNC as an Avalanche L1 / Subnet-EVM project and lists architecture, tokenomics, repo structure, and readiness state. |
| `gnc_node.env` | Shows the intended runtime environment variables for AvalancheGo nodes, including subnet, blockchain, VMID, bootstrap, and port settings. |
| `GNC_placeholder_replacement_worksheet.md` | Lists every placeholder that must be replaced before node rollout. |
| `bootstrap_gnc_node.sh` | Provides the node installation/bootstrap procedure but still references placeholder chain IDs. |
| `gnc-avalanchego.service` | Defines the intended systemd runtime service for AvalancheGo under the `gnc` user. |
| `GNC_SUBNET_ID_latest.json` | Contains subnet config settings, including Snow parameters and validator mode, but the filename still shows the placeholder pattern. |
| `gnc-t-val-01.txt`, `gnc-t-seed-01.txt`, `gnc-t-sentry-01.txt` | Validation notes show unresolved placeholders in rendered node bundles. |

## Values still needed before live integration

| Needed value | Why it matters | Current recovered state |
|---|---|---|
| Public RPC URL | Required for the hub to write/read receipts on GNC | Not found in recovered artifacts |
| Chain ID | Required for wallets, contracts, and transaction signing | Not found in recovered artifacts |
| Subnet ID | Required for Avalanche L1 tracking and node config | Placeholder remains |
| Blockchain ID | Required for Avalanche chain config paths | Placeholder remains |
| VMID | Required for Subnet-EVM plugin mapping | Placeholder remains |
| Contract address | Needed if a receipt/event smart contract already exists | Not found in recovered artifacts |
| ABI | Needed for hub contract calls | Not found in recovered artifacts |
| Funding wallet method | Needed to submit transactions | Not found; should be supplied securely, not pasted into chat |

## Practical implication for the Gemini-Manus hub

The safest path is to use GNC in one of two ways. If the live GNC RPC and chain IDs exist elsewhere, we can connect the hub directly to that endpoint and deploy a small receipt contract. If those values were never finalized, we can finish the GNC testnet launch first by resolving the placeholder worksheet, provisioning nodes, generating validator identities, and producing the final RPC endpoint.

For the hub, the on-chain role should be narrow and safe: record **task receipts**, **hashes**, **approval events**, **timestamps**, and **status transitions**. The hub should keep sensitive task content, legal documents, medical details, private messages, API keys, and wallet secrets off-chain in a private backend.
