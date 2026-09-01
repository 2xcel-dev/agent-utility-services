# Agent Utility Services (AUS) Gateway

An enterprise-hardened API gateway designed for autonomous AI agent networks. AUS provides 8 specialized utility engines exposed through a Model Context Protocol (MCP) manifest and monetized via HTTP 402 payment handshakes on Base.

---

## 🏛️ Architecture Overview

```
[ External AI Agent ]
         │
         ▼  (HTTPS / HTTP/2)
[ Cloudflare Tunnel Edge ]
         │
         ▼  (Port 3000)
[ AUS Express Gateway ]
   ├── Rate Limiter (100 req / 60s)
   ├── 402 Payment Negotiation & Anti-Replay Guard (In-Memory / Hash-Lock)
   └── Route Dispatcher
         ├── /mcp.json (Discovery Manifest)
         └── /tools/* (8 Specialized Utility Engines)
```

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v20+)
- `cloudflared` CLI
- Valid `.env` configuration:
  ```env
  PORT=3000
  NODE_ENV=production
  ANTHROPIC_API_KEY=your_key_here
  TREASURY_BASE_ADDRESS=0xYourBaseTreasuryAddress
  ```

### 2. Start the Server & Tunnel
```bash
# Terminal 1: Launch AUS Gateway
node server.js

# Terminal 2: Expose via Cloudflare Tunnel
cloudflared tunnel --protocol http2 --url http://127.0.0.1:3000
```

---

## 🛠️ MCP Tool Manifest (`GET /mcp.json`)

Agents discover all endpoints dynamically by querying `/mcp.json`:

```json
{
  "mcpVersion": "1.0.0",
  "serverInfo": {
    "name": "agent-utility-services",
    "version": "2.1.0",
    "tier": "Enterprise-Hardened"
  },
  "tools": [
    { "name": "schema_sanitizer", "endpoint": "/tools/schema-sanitizer", "price": "0.10 USDC" },
    { "name": "financial_audit", "endpoint": "/tools/financial-audit", "price": "0.20 USDC" },
    { "name": "verification_oracle", "endpoint": "/tools/verification-oracle", "price": "0.05 USDC" },
    { "name": "sandbox_execution", "endpoint": "/tools/sandbox-execution", "price": "0.25 USDC" },
    { "name": "media_transcoder", "endpoint": "/tools/media-transcoder", "price": "0.15 USDC" },
    { "name": "geospatial_verifier", "endpoint": "/tools/geospatial-verifier", "price": "0.08 USDC" },
    { "name": "claude_reason", "endpoint": "/tools/claude-reason", "price": "0.12 USDC" },
    { "name": "agentic_audit", "endpoint": "/tools/agentic-audit", "price": "0.25 USDC" }
  ]
}
```

---

## ⚡ 402 Payment Protocol & Anti-Replay

### Handshake Flow
1. **Unsettled Request:** The agent calls a tool endpoint without the `x-payment-receipt` header.
2. **402 Challenge:** The gateway halts execution and returns `HTTP 402 Payment Required`:
   ```json
   {
     "status": 402,
     "error": "Payment Required",
     "payment_request": {
       "token": "USDC",
       "network": "Base",
       "amount": "0.12",
       "destination_address": "0xYourBaseTreasuryAddress"
     }
   }
   ```
3. **Settled Execution:** The agent executes the on-chain transfer and repeats the call with the header:
   ```http
   x-payment-receipt: 0xBaseTx_f7a9...
   ```
4. **Anti-Replay Burning:** The gateway consumes and registers the hash. Any subsequent call with the identical receipt returns `HTTP 409 Conflict`.

---

## 📦 Verified Utility Fleet Reference

### 1. Claude Reasoning (`/tools/claude-reason`)
Deep analytical reasoning powered by Claude Opus 5.
- **Payload:**
  ```json
  {
    "system_instruction": "You are a treasury analyst.",
    "prompt": "State 2 benefits of agent micro-settlement channels."
  }
  ```

### 2. Sandbox Execution (`/tools/sandbox-execution`)
Secure, isolated Node.js `vm` sandbox with configurable timeout ceilings.
- **Payload:**
  ```json
  {
    "code": "const sum = input.items.reduce((a, b) => a + b, 0); output = { total: sum };",
    "context_data": { "items": [100, 200, 300] },
    "timeout_ms": 1500
  }
  ```

### 3. Verification Oracle (`/tools/verification-oracle`)
Deterministic SHA-256 state attestation and integrity hashing.
- **Payload:**
  ```json
  { "data": "Base is an Ethereum Layer 2 incubated by Coinbase." }
  ```

### 4. Media Transcoder (`/tools/media-transcoder`)
MIME analysis, byte size verification, and base64/URI media inspection.
- **Payload:**
  ```json
  {
    "data_uri": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE...",
    "target_format": "webp"
  }
  ```

### 5. Financial Audit (`/tools/financial-audit`)
Batch transaction ledger reconciliation, volume computation, and anomaly flagging.
- **Payload:**
  ```json
  {
    "transactions": [
      { "id": "tx_01", "amount": 250.00, "type": "credit", "category": "api_revenue" },
      { "id": "tx_02", "amount": 35.50, "type": "debit", "category": "gas_overhead" }
    ]
  }
  ```

### 6. Schema Sanitizer (`/tools/schema-sanitizer`)
XSS/HTML stripping, key normalization, and sensitive field masking.
- **Payload:**
  ```json
  {
    "data": { "user": "agent_01", "api_key": "sk_live_9999", "bio": "<script>alert(1)</script>hello" },
    "rules": { "stripHtml": true, "maskFields": ["api_key"] }
  }
  ```

### 7. Geospatial Verifier (`/tools/geospatial-verifier`)
Haversine distance calculation and geofence boundary verification.
- **Payload:**
  ```json
  {
    "origin": { "lat": 52.2681, "lng": -113.8112 },
    "destination": { "lat": 51.0447, "lng": -114.0719 }
  }
  ```

### 8. Agentic Audit (`/tools/agentic-audit`)
Execution step health scoring, latency tracking, and circular loop detection for autonomous workflows.
- **Payload:**
  ```json
  {
    "agent_id": "agent_treasury_01",
    "steps": [
      { "step": 1, "action": "fetch_balance", "status": "success", "latency_ms": 45 },
      { "step": 2, "action": "burn_receipt", "status": "success", "latency_ms": 120 }
    ]
  }
  ```

---

## 🛡️ Security Hardening

- **Rate Limiting:** `express-rate-limit` enforces a ceiling of 100 requests per 60-second window per IP.
- **Receipt Collision Guard:** In-memory ledger flags and blocks replayed transaction hashes immediately.
- **VM Sandboxing:** Script timeouts prevent CPU exhaustion attacks; execution contexts lack access to host `process`, `fs`, or network bindings.
- **Edge Routing:** Direct origin isolation via Cloudflare Tunnel over HTTP/2.
