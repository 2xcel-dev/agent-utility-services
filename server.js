require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const Anthropic = require('@anthropic-ai/sdk');
const crypto = require('crypto');
const vm = require('vm');
const { PostHog } = require('posthog-node');

const posthog = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1,
      flushInterval: 0
    })
  : null;

function trackAgentTelemetry(eventName, properties = {}) {
  if (!posthog) return;
  const distinctId = properties.agent_id || properties.client_ip || 'aus_fleet_runner';

  posthog.capture({
    distinctId: String(distinctId),
    event: eventName,
    properties: {
      ...properties,
      project_id: '589097',
      environment: process.env.NODE_ENV || 'production',
      timestamp: new Date().toISOString()
    }
  });
}
const app = express();
const PORT = process.env.PORT || 3000;
const PAYMENT_WALLET = process.env.BASE_WALLET || "0xFallbackWalletAddressHere";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// 1. Strict JSON Body Limit (Prevent Memory Exhaustion Flooding)
app.use(express.json({ limit: '2mb' }));

// 2. Swarm Rate Limiter: Max 100 requests per minute per IP
const swarmLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too Many Requests",
    message: "Swarm threshold exceeded. Rate limit active (100 req/min)."
  }
});
app.use(swarmLimiter);
// PostHog Global Response Telemetry Interceptor
app.use((req, res, next) => {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args) {
    if (req.path.startsWith('/tools/')) {
      const durationMs = Date.now() - start;
      const toolName = req.path.replace('/tools/', '');
      const agentId = req.headers['x-agent-id'] || req.body?.agent_id || 'anonymous_agent';

      trackAgentTelemetry('tool_request_completed', {
        tool: toolName,
        agent_id: agentId,
        status_code: res.statusCode,
        duration_ms: durationMs,
        paid: !!req.headers['x-payment-receipt'],
        client_ip: req.ip
      });
    }
    return originalEnd.apply(this, args);
  };

  next();
});
// 3. In-Memory Spent Receipt Cache (Replay Attack Defense)
const spentReceipts = new Set();

const toolPrices = {
  "schema-sanitizer": "0.10",
  "financial-audit": "0.20",
  "verification-oracle": "0.05",
  "sandbox-execution": "0.25",
  "media-transcoder": "0.15",
  "geospatial-verifier": "0.08",
  "claude-reason": "0.12",
  "agentic-audit": "0.25"
};

// --- ENTERPRISE UNIFIED SECURITY MIDDLEWARE ---
const enterpriseGateway = (req, res, next) => {
  const toolName = req.params.tool;
  const price = toolPrices[toolName];
  const paymentProof = req.headers['x-payment-receipt'];
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;

  req.meta = { requestId, toolName, timestamp: new Date().toISOString() };

  // Validate Tool Exists
  if (!price) {
    return res.status(404).json({
      success: false,
      error: "Not Found",
      message: `The requested utility '${toolName}' does not exist on this gateway.`
    });
  }

  // x402 Payment Interception Gate
  if (!paymentProof) {
    return res.status(402).json({
      error: "Payment Required",
      message: `Execution of ${toolName} requires settlement.`,
      payment_request: {
        network: "Base",
        token: "USDC",
        amount: price,
        destination_address: PAYMENT_WALLET,
        memo: `AUS-${toolName}-${requestId}`
      }
    });
  }

  // Anti-Replay Verification Check
  if (spentReceipts.has(paymentProof)) {
    return res.status(409).json({
      success: false,
      error: "Payment Conflict",
      message: "Receipt already consumed. Replay attack blocked."
    });
  }

  // Burn the receipt
  spentReceipts.add(paymentProof);

  console.log(`[ENTERPRISE AUDIT] [${req.meta.timestamp}] ID: ${requestId} | Tool: ${toolName} | Receipt Burned: ${paymentProof}`);
  next();
};

app.get('/mcp.json', (req, res) => {
  res.json({
    mcpVersion: "1.0.0",
    serverInfo: { name: "agent-utility-services", version: "2.1.0", tier: "Enterprise-Hardened" },
    tools: Object.entries(toolPrices).map(([name, price]) => ({
      name: name.replace(/-/g, '_'),
      endpoint: `/tools/${name}`,
      price: `${price} USDC`
    }))
  });
});

app.get('/health', (req, res) => res.json({ status: "online", network: "Base", tier: "Enterprise-Hardened", active_engines: 8 }));

// --- ENGINE 1: Claude Reason ---
app.post('/tools/claude-reason', (req, res, next) => { req.params.tool = "claude-reason"; next(); }, enterpriseGateway, async (req, res) => {
  try {
    const { prompt, system_instruction } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: "Missing 'prompt' field in payload." });

    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      system: system_instruction || "You are an advanced autonomous agent utility engine operating on a secure gateway.",
      messages: [{ role: 'user', content: prompt }]
    });

    const textOutput = (response.content.find(c => c.type === 'text') || {}).text || '';

    res.json({
      success: true,
      utility: "claude-reason",
      request_id: req.meta.requestId,
      result: textOutput,
      usage: response.usage
    });
  } catch (error) {
    res.status(500).json({ success: false, error: "Upstream AI execution failed.", details: error.message });
  }
});

// --- ENGINE 2: Financial Audit ---
app.post('/tools/financial-audit', (req, res, next) => { req.params.tool = "financial-audit"; next(); }, enterpriseGateway, (req, res) => {
  const { transactions, threshold } = req.body;
  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ success: false, error: "Invalid payload. 'transactions' array required." });
  }

  let totalVolume = 0;
  let flaggedCount = 0;
  const riskLimit = threshold || 10000;

  const auditedTransactions = transactions.map(tx => {
    totalVolume += (tx.amount || 0);
    const isFlagged = (tx.amount || 0) > riskLimit || tx.risk_score > 0.7;
    if (isFlagged) flaggedCount++;
    return { ...tx, audited: true, flagged: isFlagged };
  });

  const overallRiskScore = (flaggedCount / transactions.length).toFixed(2);

  res.json({
    success: true,
    utility: "financial-audit",
    request_id: req.meta.requestId,
    audit_summary: {
      total_items_analyzed: transactions.length,
      total_volume: totalVolume,
      flagged_transactions: flaggedCount,
      risk_index: Number(overallRiskScore),
      status: overallRiskScore > 0.3 ? "HIGH_RISK" : "PASSED"
    },
    data: auditedTransactions
  });
});

// --- ENGINE 3: Verification Oracle ---
app.post('/tools/verification-oracle', (req, res, next) => { req.params.tool = "verification-oracle"; next(); }, enterpriseGateway, (req, res) => {
  const { data, expected_hash, algorithm } = req.body;
  if (!data) return res.status(400).json({ success: false, error: "Missing 'data' string or object in payload." });

  const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
  const hashAlgo = algorithm || 'sha256';
  const computedHash = crypto.createHash(hashAlgo).update(dataString).digest('hex');
  const matches = expected_hash ? computedHash.toLowerCase() === expected_hash.toLowerCase() : null;

  res.json({
    success: true,
    utility: "verification-oracle",
    request_id: req.meta.requestId,
    attestation: {
      algorithm: hashAlgo,
      computed_hash: computedHash,
      matches_expected: matches,
      verified_at: new Date().toISOString()
    }
  });
});

// --- ENGINE 4: Sandbox Execution ---
app.post('/tools/sandbox-execution', (req, res, next) => { req.params.tool = "sandbox-execution"; next(); }, enterpriseGateway, (req, res) => {
  const { code, context_data, timeout_ms } = req.body;
  if (!code) return res.status(400).json({ success: false, error: "Missing 'code' string in payload." });

  const sandbox = { input: context_data || {}, output: null, Math, Date, JSON };
  const context = vm.createContext(sandbox);
  const timeout = Math.min(timeout_ms || 1000, 3000);

  try {
    const startTime = process.hrtime();
    const script = new vm.Script(code);
    script.runInContext(context, { timeout });
    const diff = process.hrtime(startTime);
    const executionTimeMs = (diff[0] * 1e3 + diff[1] * 1e-6).toFixed(3);

    res.json({
      success: true,
      utility: "sandbox-execution",
      request_id: req.meta.requestId,
      execution_time_ms: Number(executionTimeMs),
      result: sandbox.output !== undefined ? sandbox.output : "Execution completed without setting output variable."
    });
  } catch (err) {
    res.status(422).json({ success: false, utility: "sandbox-execution", error: err.message });
  }
});

// --- ENGINE 5: Schema Sanitizer ---
app.post('/tools/schema-sanitizer', (req, res, next) => { req.params.tool = "schema-sanitizer"; next(); }, enterpriseGateway, (req, res) => {
  const payload = req.body;
  if (!payload || typeof payload !== 'object') {
    return res.status(400).json({ success: false, error: "Invalid JSON object provided." });
  }

  const cleanObject = (obj) => {
    const cleaned = {};
    for (const [key, val] of Object.entries(obj)) {
      const sanitizedKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      if (typeof val === 'string') {
        cleaned[sanitizedKey] = val.replace(/<[^>]*>?/gm, '').trim();
      } else if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        cleaned[sanitizedKey] = cleanObject(val);
      } else {
        cleaned[sanitizedKey] = val;
      }
    }
    return cleaned;
  };

  const sanitized = cleanObject(payload);
  res.json({
    success: true,
    utility: "schema-sanitizer",
    request_id: req.meta.requestId,
    sanitized_at: new Date().toISOString(),
    analysis: {
      original_keys_count: Object.keys(payload).length,
      sanitized_keys: Object.keys(sanitized)
    },
    data: sanitized
  });
});

// --- ENGINE 6: Geospatial Verifier ---
app.post('/tools/geospatial-verifier', (req, res, next) => { req.params.tool = "geospatial-verifier"; next(); }, enterpriseGateway, (req, res) => {
  const { origin, destination, max_radius_km } = req.body;
  if (!origin || !origin.lat || !origin.lng || !destination || !destination.lat || !destination.lng) {
    return res.status(400).json({ success: false, error: "Origin and Destination coordinates (lat, lng) required." });
  }

  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(destination.lat - origin.lat);
  const dLng = toRad(destination.lng - origin.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(origin.lat)) * Math.cos(toRad(destination.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distanceKm = Number((R * c).toFixed(3));

  const withinGeofence = max_radius_km !== undefined ? distanceKm <= max_radius_km : null;

  res.json({
    success: true,
    utility: "geospatial-verifier",
    request_id: req.meta.requestId,
    calculation: {
      distance_km: distanceKm,
      distance_miles: Number((distanceKm * 0.621371).toFixed(3)),
      geofence_threshold_km: max_radius_km || null,
      within_geofence: withinGeofence
    }
  });
});

// --- ENGINE 7: Media Transcoder ---
app.post('/tools/media-transcoder', (req, res, next) => { req.params.tool = "media-transcoder"; next(); }, enterpriseGateway, (req, res) => {
  const { data_uri, base64_data, mime_type } = req.body;
  if (!data_uri && !base64_data) {
    return res.status(400).json({ success: false, error: "Provide either data_uri or base64_data in payload." });
  }

  let rawBase64 = base64_data || '';
  let detectedMime = mime_type || 'application/octet-stream';

  if (data_uri && data_uri.startsWith('data:')) {
    const parts = data_uri.split(',');
    detectedMime = parts[0].split(':')[1].split(';')[0];
    rawBase64 = parts[1];
  }

  const buffer = Buffer.from(rawBase64, 'base64');
  const hash = crypto.createHash('sha256').update(buffer).digest('hex');

  res.json({
    success: true,
    utility: "media-transcoder",
    request_id: req.meta.requestId,
    media_analysis: {
      mime_type: detectedMime,
      byte_size: buffer.length,
      kilobytes: Number((buffer.length / 1024).toFixed(2)),
      content_sha256: hash,
      is_valid_binary: buffer.length > 0
    }
  });
});

// --- ENGINE 8: Agentic Audit ---
app.post('/tools/agentic-audit', (req, res, next) => { req.params.tool = "agentic-audit"; next(); }, enterpriseGateway, (req, res) => {
  const { steps, budget_limit } = req.body;
  if (!steps || !Array.isArray(steps)) {
    return res.status(400).json({ success: false, error: "Array of execution 'steps' required." });
  }

  let totalExecutionCost = 0;
  let failedSteps = 0;
  const loopMap = {};
  let potentialLoops = 0;

  steps.forEach((step) => {
    totalExecutionCost += (step.cost || 0);
    if (step.status === 'FAILED' || step.error) failedSteps++;
    if (step.action) {
      loopMap[step.action] = (loopMap[step.action] || 0) + 1;
      if (loopMap[step.action] > 2) potentialLoops++;
    }
  });

  const withinBudget = budget_limit !== undefined ? totalExecutionCost <= budget_limit : null;

  res.json({
    success: true,
    utility: "agentic-audit",
    request_id: req.meta.requestId,
    trace_summary: {
      total_steps: steps.length,
      failed_steps: failedSteps,
      potential_action_loops: potentialLoops,
      cumulative_cost: Number(totalExecutionCost.toFixed(4)),
      budget_limit: budget_limit || null,
      within_budget: withinBudget,
      health_score: Number((((steps.length - failedSteps) / steps.length) * (potentialLoops > 0 ? 0.7 : 1.0)).toFixed(2))
    }
  });
});

app.listen(PORT, () => console.log(`Hardened AUS Gateway running on port ${PORT} with Anti-Replay & Rate Limiting active.`));
