const https = require('https');

const BASE_URL = 'https://except-platform-martin-spoken.trycloudflare.com';

function request(path, options = {}, payload = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = https.request(url, reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) {
      req.write(JSON.stringify(payload));
    }
    req.end();
  });
}

async function runAutonomousSimulation() {
  console.log('🤖 [AGENT SIMULATION] Connecting to Public Gateway...');
  
  // 1. Discover Tools
  const manifest = await request('/mcp.json');
  console.log('📋 [DISCOVERY] Found tools:', manifest.data.tools.map(t => `${t.name} (${t.price})`).join(', '));

  // 2. Unsettled Request (Expect 402)
  console.log('\n🔒 [HANDSHAKE] Sending unsettled prompt to claude-reason...');
  const challenge = await request('/tools/claude-reason', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { prompt: 'Identify 2 risks of agentic economies.' });
  
  console.log(`⚠️ [402 CHALLENGE] Intercepted with status ${challenge.status}:`, challenge.data.message);
  console.log(`💳 [PAYMENT REQUIRED] ${challenge.data.payment_request.amount} ${challenge.data.payment_request.token} to ${challenge.data.payment_request.destination_address}`);

  // 3. Settled Execution (Simulate Base settlement hash)
  const simulatedReceipt = `0xBaseTx_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  console.log(`\n⚡ [SETTLEMENT] Attaching receipt: ${simulatedReceipt}`);
  
  const execution = await request('/tools/claude-reason', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-payment-receipt': simulatedReceipt
    }
  }, {
    system_instruction: 'You are an autonomous treasury analyst.',
    prompt: 'Summarize the advantage of micro-settlement channels for AI agents in two concise bullet points.'
  });

  console.log(`\n✅ [EXECUTION SUCCESS] (Status ${execution.status}):`);
  console.log(execution.data.result);
}

runAutonomousSimulation();
