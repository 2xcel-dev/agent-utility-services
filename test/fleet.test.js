const http = require('http');

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';

function request(path, options = {}, payload = null) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: HOST,
      port: PORT,
      path: path,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), raw: data });
        } catch {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(JSON.stringify(payload));
    req.end();
  });
}

function getReceipt(tag) {
  return `0xBaseTx_${tag}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

async function runSuite() {
  console.log('🧪 ===============================================');
  console.log(`🚀 RUNNING AUS FLEET TEST SUITE (http://${HOST}:${PORT})`);
  console.log('🧪 ===============================================\n');

  let passed = 0;
  let failed = 0;

  async function assertTest(name, fn) {
    try {
      await fn();
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Tool Discovery
  await assertTest('MCP Discovery Manifest (/mcp.json)', async () => {
    const res = await request('/mcp.json');
    if (res.status !== 200 || !res.data.tools || res.data.tools.length !== 8) {
      throw new Error(`Expected 8 tools and 200 OK, got ${res.status}`);
    }
  });

  // 2. 402 Monetization Challenge
  await assertTest('402 Payment Required Challenge', async () => {
    const res = await request('/tools/financial-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { transactions: [] });
    if (res.status !== 402 || !res.data.payment_request) {
      throw new Error(`Expected 402 Payment Required, got ${res.status}`);
    }
  });

  // 3. Anti-Replay Ledger Defense (409 Conflict)
  await assertTest('Anti-Replay Receipt Defense (409 Conflict)', async () => {
    const receipt = getReceipt('replay_guard');
    const firstCall = await request('/tools/verification-oracle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-receipt': receipt }
    }, { data: 'attest_first' });

    if (firstCall.status !== 200) throw new Error(`Initial call failed: ${firstCall.status}`);

    const replayCall = await request('/tools/verification-oracle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-receipt': receipt }
    }, { data: 'attest_first' });

    if (replayCall.status !== 409) {
      throw new Error(`Expected 409 Conflict on replay, got ${replayCall.status}`);
    }
  });

  // 4. Sandbox Execution
  await assertTest('Tool: sandbox-execution', async () => {
    const res = await request('/tools/sandbox-execution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-receipt': getReceipt('sandbox') }
    }, {
      code: 'output = { sum: input.a + input.b };',
      context_data: { a: 15, b: 35 }
    });
    if (res.status !== 200 || res.data.result.sum !== 50) {
      throw new Error(`Sandbox execution failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 5. Verification Oracle
  await assertTest('Tool: verification-oracle', async () => {
    const res = await request('/tools/verification-oracle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-receipt': getReceipt('oracle') }
    }, { data: 'AUS attestation test payload' });
    if (res.status !== 200 || !res.data.attestation.computed_hash) {
      throw new Error(`Oracle verification failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 6. Media Transcoder
  await assertTest('Tool: media-transcoder', async () => {
    const res = await request('/tools/media-transcoder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-receipt': getReceipt('media') }
    }, {
      data_uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      target_format: 'webp'
    });
    if (res.status !== 200 || !res.data.media_analysis.is_valid_binary) {
      throw new Error(`Media transcoding inspection failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 7. Financial Audit
  await assertTest('Tool: financial-audit', async () => {
    const res = await request('/tools/financial-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-receipt': getReceipt('audit') }
    }, {
      transactions: [
        { id: 't1', amount: 100, type: 'credit' },
        { id: 't2', amount: 20, type: 'debit' }
      ]
    });
    if (res.status !== 200 || res.data.audit_summary.status !== 'PASSED') {
      throw new Error(`Financial audit failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 8. Schema Sanitizer
  await assertTest('Tool: schema-sanitizer', async () => {
    const res = await request('/tools/schema-sanitizer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-receipt': getReceipt('sanitizer') }
    }, {
      data: { name: 'admin', secret: '12345', text: '<b>clean</b>' },
      rules: { stripHtml: true, maskFields: ['secret'] }
    });
    if (res.status !== 200) throw new Error(`Schema sanitizer failed: ${JSON.stringify(res.data)}`);
  });

  // 9. Geospatial Verifier
  await assertTest('Tool: geospatial-verifier', async () => {
    const res = await request('/tools/geospatial-verifier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-receipt': getReceipt('geo') }
    }, {
      origin: { lat: 52.2681, lng: -113.8112 },
      destination: { lat: 51.0447, lng: -114.0719 }
    });
    if (res.status !== 200 || !res.data.calculation.distance_km) {
      throw new Error(`Geospatial calculation failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 10. Agentic Audit
  await assertTest('Tool: agentic-audit', async () => {
    const res = await request('/tools/agentic-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-receipt': getReceipt('agentic') }
    }, {
      agent_id: 'agent_01',
      steps: [{ step: 1, action: 'init', status: 'success' }]
    });
    if (res.status !== 200 || res.data.trace_summary.health_score !== 1) {
      throw new Error(`Agentic audit failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 11. Claude Reason (Opus Inference)
  await assertTest('Tool: claude-reason', async () => {
    const res = await request('/tools/claude-reason', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-payment-receipt': getReceipt('claude') }
    }, {
      system_instruction: 'You are a test harness.',
      prompt: 'Respond with exactly: OK'
    });
    if (res.status !== 200 || !res.data.result) {
      throw new Error(`Claude inference failed: ${JSON.stringify(res.data)}`);
    }
  });

  console.log('\n===============================================');
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed`);
  console.log('===============================================\n');

  if (failed > 0) process.exit(1);
}

runSuite();
