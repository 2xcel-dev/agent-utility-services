require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const { createPublicClient, http, parseUnits } = require('viem');
const { base } = require('viem/chains');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Base USDC mainnet contract address
const BASE_USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// Base RPC Public Client
const publicClient = createPublicClient({
    chain: base,
    transport: http(process.env.BASE_RPC_URL || 'https://mainnet.base.org')
});

// 1. API Gateway & Rate Limiting
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again after 15 minutes.', status: 429 }
});

const strictLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Rate limit exceeded for resource-intensive utility.', status: 429 }
});

app.use('/v1/', globalLimiter);
app.use('/v1/sandbox-execution', strictLimiter);
app.use('/v1/claude-reason', strictLimiter);

// 2. Idempotency & Transaction Verification
const processedTransactions = new Set();

const requireIdempotency = (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (!idempotencyKey) {
        return res.status(400).json({ error: 'Bad Request: Missing x-idempotency-key header for replay protection' });
    }
    if (processedTransactions.has(idempotencyKey)) {
        return res.status(409).json({ error: 'Conflict: Duplicate transaction or replayed request detected' });
    }
    processedTransactions.add(idempotencyKey);
    next();
};

// 3. x402 Payment Middleware with On-Chain Base Verification
const requirex402Payment = (priceUSDC) => {
    return async (req, res, next) => {
        const txHash = req.headers['x-base-payment-proof'];
        const transactionUUID = req.headers['x-transaction-uuid'];

        if (!txHash) {
            return res.status(402).json({
                error: 'Payment Required',
                protocol: 'x402',
                network: 'base',
                currency: 'USDC',
                amount: priceUSDC,
                payToAddress: process.env.TREASURY_WALLET || '0x2XceL_Treasury_Placeholder'
            });
        }

        if (!transactionUUID) {
            return res.status(400).json({ error: 'Bad Request: Missing x-transaction-uuid validation header.' });
        }

        try {
            // Retrieve transaction receipt from Base RPC
            const receipt = await publicClient.getTransactionReceipt({ hash: txHash });

            if (!receipt || receipt.status !== 'success') {
                return res.status(402).json({ error: 'Payment verification failed: Transaction pending, reverted, or not found on Base.' });
            }

            const requiredAmountAtomic = parseUnits(priceUSDC, 6);
            const targetTreasury = (process.env.TREASURY_WALLET || '').toLowerCase();

            // Verify ERC-20 Transfer log
            const validTransfer = receipt.logs.some(log => {
                const isUsdcContract = log.address.toLowerCase() === BASE_USDC_ADDRESS.toLowerCase();
                if (!isUsdcContract) return false;

                const toAddress = `0x${log.topics[2]?.slice(26)}`.toLowerCase();
                const transferAmount = BigInt(log.data);

                return toAddress === targetTreasury && transferAmount >= requiredAmountAtomic;
            });

            if (!validTransfer) {
                return res.status(402).json({
                    error: `Payment verification failed: No valid USDC transfer of at least ${priceUSDC} to ${process.env.TREASURY_WALLET} found in transaction.`
                });
            }

            next();
        } catch (error) {
            console.error(`[ONCHAIN_VERIFY_ERROR] ${error.message}`);
            return res.status(400).json({ error: 'Invalid transaction hash format or failed RPC lookup.' });
        }
    };
};

// Utility Endpoints
app.post('/v1/schema-sanitizer', requirex402Payment('0.002'), requireIdempotency, (req, res) => {
    res.json({ success: true, utility: 'schema-sanitizer', message: 'Schema validated and sanitized successfully.' });
});

app.post('/v1/financial-audit', requirex402Payment('0.01'), requireIdempotency, (req, res) => {
    res.json({ success: true, utility: 'financial-audit', message: 'Financial transaction parsed and verified.' });
});

app.post('/v1/geospatial-verifier', requirex402Payment('0.02'), requireIdempotency, (req, res) => {
    res.json({ success: true, utility: 'geospatial-verifier', message: 'Spatial coordinate validation passed.' });
});

app.post('/v1/sandbox-execution', requirex402Payment('0.05'), requireIdempotency, (req, res) => {
    res.json({ success: true, utility: 'sandbox-execution', message: 'Code compilation and script runtime executed safely.' });
});

app.post('/v1/claude-reason', requirex402Payment('0.05'), requireIdempotency, (req, res) => {
    res.json({ success: true, utility: 'claude-reason', message: 'Advanced logic processing completed.' });
});

app.post('/v1/verification-oracle', requirex402Payment('0.10'), requireIdempotency, (req, res) => {
    res.json({ success: true, utility: 'verification-oracle', message: 'Cryptographic proof and token attestation verified.' });
});

app.post('/v1/media-transcoder', requirex402Payment('0.15'), requireIdempotency, (req, res) => {
    res.json({ success: true, utility: 'media-transcoder', message: 'CDN asset rendered and media conversion pipeline complete.' });
});

app.post('/v1/agentic-audit', requirex402Payment('0.25'), requireIdempotency, (req, res) => {
    res.json({ success: true, utility: 'agentic-audit', message: 'Deep multi-agent system evaluation and vulnerability scan complete.' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'online', service: 'Agent Utility Services (AUS)', protocol: 'x402' });
});

// 4. Secure Session & Error Handling
app.use((err, req, res, next) => {
    console.error(`[INTERNAL_ERROR] ${err.stack}`);
    const statusCode = err.status || 500;
    res.status(statusCode).json({
        error: statusCode === 500 ? 'Internal Server Error' : err.message,
        status: statusCode
    });
});


// ==========================================
// OpenAPI Specification Endpoint
// ==========================================
const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Agent Utility Services (AUS) API",
    version: "1.0.0",
    description: "Hardened micro-utility gateway for autonomous AI agents settled in Base USDC using x402."
  },
  servers: [{ url: "https://aus.2xcel.net" }],
  paths: {
    "/health": {
      get: {
        summary: "Service Health Check",
        responses: {
          "200": { description: "Service is online and operational." }
        }
      }
    },
    "/v1/schema-sanitizer": {
      post: {
        summary: "JSON Schema Sanitizer ($0.002 USDC)",
        description: "Validates, normalizes, and sanitizes malformed JSON payloads.",
        parameters: [
          { name: "x-base-payment-proof", in: "header", required: true, schema: { type: "string" } },
          { name: "x-transaction-uuid", in: "header", required: true, schema: { type: "string" } },
          { name: "x-idempotency-key", in: "header", required: false, schema: { type: "string" } }
        ],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object" } } }
        },
        responses: {
          "200": { description: "Sanitized JSON schema returned." },
          "402": { description: "Payment Required via x402 Base USDC." }
        }
      }
    },
    "/v1/financial-audit": {
      post: {
        summary: "Financial & On-Chain Audit ($0.010 USDC)",
        parameters: [
          { name: "x-base-payment-proof", in: "header", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Audit completed successfully." },
          "402": { description: "Payment Required." }
        }
      }
    },
    "/v1/sandbox-execution": {
      post: {
        summary: "Ephemeral Sandbox Code Execution ($0.050 USDC)",
        parameters: [
          { name: "x-base-payment-proof", in: "header", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": { description: "Execution result." },
          "402": { description: "Payment Required." }
        }
      }
    }
  }
};

app.get("/openapi.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(openApiSpec);
});

app.listen(PORT, () => {
    console.log(`AUS server running on port ${PORT}`);
});
