# Agent Utility Services (AUS)

[![Protocol](https://img.shields.io/badge/Protocol-x402-blue.svg)](https://x402.org)
[![Network](https://img.shields.io/badge/Network-Base%20Mainnet-0052FF.svg)](https://base.org)
[![Currency](https://img.shields.io/badge/Settlement-USDC-2775CA.svg)](https://basescan.org/token/0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

A high-performance, hardened micro-utility gateway engineered for autonomous AI agents, multi-agent frameworks, and programmatic callers. All endpoints settle in sub-cent and micro-dollar **USDC on Base** using the open **x402 Payment Required** standard.

---

## 🛡️ Enterprise Security & Hardening Features

* **Live On-Chain Settlement Verification:** Real-time RPC transaction verification via viem. Cryptographically validates transaction receipts, confirms official Base USDC contract events, verifies destination treasury addresses, and ensures exact atomic transfer amounts.
* **Idempotency & Replay Protection:** Enforces unique x-idempotency-key and x-transaction-uuid headers on stateful requests. Replayed or duplicate transaction proofs are rejected with 409 Conflict.
* **Layered Rate Limiting:** 
  * Standard Tier: 100 requests per 15-minute window across /v1/*.
  * Strict Tier: 10 requests per 60-second window on compute-heavy routes (/v1/sandbox-execution, /v1/claude-reason).
* **Environment Variable Isolation:** Strict separation of runtime configuration, RPC nodes, and treasury wallet addresses.
* **Sanitized Error Handling:** Global middleware catches exceptions and prevents internal stack trace leaks to API consumers.

---

## ⚡ Utility Endpoints & Pricing

| Endpoint | Method | Rate Limit Tier | Price (Base USDC) | Description |
| :--- | :--- | :--- | :--- | :--- |
| /v1/schema-sanitizer | POST | Global (100 / 15m) | **$0.002** | Validates, normalizes, and strips malformed JSON schemas. |
| /v1/financial-audit | POST | Global (100 / 15m) | **$0.010** | Verifies on-chain accounting logs and financial logic. |
| /v1/geospatial-verifier | POST | Global (100 / 15m) | **$0.020** | Spatial coordinate, bounding box, and geo-polygon verification. |
| /v1/sandbox-execution | POST | Strict (10 / 1m) | **$0.050** | Ephemeral, isolated code execution and runtime compilation. |
| /v1/claude-reason | POST | Strict (10 / 1m) | **$0.050** | High-context heuristic analysis and complex logical deduction. |
| /v1/verification-oracle | POST | Global (100 / 15m) | **$0.100** | Cryptographic proof and token attestation validation. |
| /v1/media-transcoder | POST | Global (100 / 15m) | **$0.150** | Media optimization, conversion, and edge CDN rendering. |
| /v1/agentic-audit | POST | Global (100 / 15m) | **$0.250** | Deep multi-agent security evaluation and vulnerability scans. |
| /health | GET | Open | **Free** | Real-time health, uptime, and protocol verification. |