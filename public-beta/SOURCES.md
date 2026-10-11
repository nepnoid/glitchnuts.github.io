# Public-beta implementation references

- [Besu QBFT network setup](https://docs.besu-eth.org/private-networks/tutorials/qbft): four validators required for Byzantine-fault tolerance, permissioned proof-of-authority consensus, genesis extraData and validator keys, private network must be protected by firewall. Four validators on one host provide no host-level redundancy. The permissive RPC examples in the tutorial are not public deployment defaults.
- [Besu JSON-RPC reference](https://docs.besu-eth.org/public-networks/reference/api): ETH/NET/WEB3 endpoints; the gateway exposes only a bounded method allowlist and rejects signing, account unlocking, mining, debug, and validator-administration methods.
- [Besu release 26.9.0](https://github.com/besu-eth/besu/releases/tag/26.9.0): pinned client binary; release checksum must match the downloaded tarball before running it.
- [Turnstile server-side verification](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/): CAPTCHA tokens require backend Siteverify validation, single use, expire after five minutes, maximum 2,048 characters, and hostname/action checks. Verification failures and network timeouts must reject faucet claims. Secret never enters the frontend.

The current setup is a development/public-beta permissioned EVM network. GNC is an ERC-20 test token, native test gas is separate, and no test token is redeemable through this application. Publishing source or preparing Docker configuration does not establish a live persistent endpoint.
