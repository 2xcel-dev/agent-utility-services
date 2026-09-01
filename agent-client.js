const https = require('https');
const http = require('http');

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://127.0.0.1:3000';
const AGENT_ID = 'autonomous-fleet-worker-01';

async function request(endpoint, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, GATEWAY_URL);
    const client = url.protocol === 'https:' ? https : http;

    const req = client.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAgent() {
  console.log(`🤖 Initializing Agent: ${AGENT_ID}`);
  
  // 1. Discover Tools via MCP
  console.log('\n🔍 Discovering fleet tools via /mcp.json...');
  const mcp = await request('/mcp.json', { method: 'GET' });
  console.log(`Found ${mcp.body.tools?.length || 0} registered engines.`);

  // 2. Attempt Unpaid Request (Expect 402)
  const toolEndpoint = '/tools/sandbox-execution';
  console.log(`\n⚡ Calling ${toolEndpoint} without payment receipt...`);
  const initialCall = await request(toolEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-agent-id': AGENT_ID }
  }, { code: 'console.log("Hello from Autonomous Agent");' });

  if (initialCall.status === 402) {
    console.log(`🔒 Received 402 Payment Required!`);
    console.log(`   Message: ${initialCall.body.message || 'Payment needed'}`);
    console.log(`   Target Wallet: ${initialCall.body.payment_request?.destination_address || initialCall.body.wallet}`);

    // 3. Attach Payment Receipt & Re-execute
    console.log('\n💳 Simulating settled transaction receipt on Base...');
    const fakeTxHash = '0x' + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('');

    const paidCall = await request(toolEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-agent-id': AGENT_ID,
        'x-payment-receipt': fakeTxHash
      }
    }, { code: 'console.log("Autonomous agent task executed successfully")' });

    console.log(`\n✅ Paid Execution [Status ${paidCall.status}]:`);
    console.log(JSON.stringify(paidCall.body, null, 2));
  } else {
    console.log(`Response [Status ${initialCall.status}]:`, initialCall.body);
  }
}

runAgent().catch(console.error);
