import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUS_BASE_URL = process.env.AUS_BASE_URL || "https://aus.2xcel.net";
const ADMIN_KEY = process.env.AUS_ADMIN_KEY || "";

const registry = {
    "schema-sanitizer": { cost: 0.002, desc: "Validate and sanitize structured JSON schemas." },
    "financial-audit": { cost: 0.010, desc: "Run automated mathematical checks and ledger reconciliation." },
    "geospatial-verifier": { cost: 0.020, file: "geospatial-verifier.json" },
    "sandbox-execution": { cost: 0.050, file: "sandbox-execution.json" },
    "claude-reason": { cost: 0.050, desc: "Perform structured analytical reasoning." },
    "verification-oracle": { cost: 0.100, desc: "Execute cryptographic and logic verification checks." },
    "media-transcoder": { cost: 0.150, file: "media-transcoder.json" },
    "agentic-audit": { cost: 0.250, file: "agentic-audit.json" }
};

const server = new Server(
  { name: "2xcel-aus-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = Object.entries(registry).map(([name, meta]) => {
    let inputSchema = { type: "object", properties: { data: { type: "object" } }, required: ["data"] };
    
    if (meta.file) {
      const filePath = path.join(__dirname, meta.file);
      if (fs.existsSync(filePath)) {
        inputSchema = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      }
    }

    return {
      name: name.replace(/-/g, '_'),
      description: `[Cost: $${meta.cost.toFixed(3)}] ${meta.desc || inputSchema.description || `Execution profile for ${name}`}`,
      inputSchema
    };
  });

  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name.replace(/_/g, '-');
  
  if (!registry[toolName]) {
    throw new Error(`Endpoint /v1/${toolName} not found in registry.`);
  }

  const meta = registry[toolName];

  if (meta.file) {
    const filePath = path.join(__dirname, meta.file);
    const schema = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : {};
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ status: "success", endpoint: `/v1/${toolName}`, cost: meta.cost, schema, payload: request.params.arguments }, null, 2)
      }]
    };
  }

  const headers = { "Content-Type": "application/json" };
  if (ADMIN_KEY) headers["x-admin-key"] = ADMIN_KEY;

  const response = await fetch(`${AUS_BASE_URL}/tools/${toolName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(request.params.arguments)
  });

  const data = await response.json();
  return {
    content: [{
      type: "text",
      text: JSON.stringify({ status: "success", endpoint: `/v1/${toolName}`, cost: meta.cost, result: data }, null, 2)
    }]
  };
});

const transport = new StdioServerTransport();
server.connect(transport).catch(console.error);
