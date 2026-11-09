#!/usr/bin/env node
/**
 * UniFi Site Manager MCP server.
 * Reads https://api.ui.com with the X-API-KEY header.
 * The key is taken from UNIFI_SITE_MANAGER_API_KEY and is never printed.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { pathToFileURL } from "node:url";
import { TOOLS, callTool, createApi, createClientFromEnv } from "./lib.js";

const PROXY_ENV_NAMES = [
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "NPM_CONFIG_PROXY",
  "NPM_CONFIG_HTTPS_PROXY",
  "GLOBAL_AGENT_HTTP_PROXY",
  "GLOBAL_AGENT_HTTPS_PROXY",
];

export function lockdownOutboundEnv() {
  process.env.NODE_USE_ENV_PROXY = "0";
  for (const name of PROXY_ENV_NAMES) delete process.env[name];
}

function publicErrorText(api, err) {
  let message = err instanceof Error && err.message ? err.message : "UniFi Site Manager request failed";
  if (api?.redactMessage) message = api.redactMessage(message);
  const secret = process.env.UNIFI_SITE_MANAGER_API_KEY;
  if (typeof secret === "string" && secret.length >= 8 && typeof message === "string") {
    message = message.split(secret).join("[redacted]");
  }
  if (typeof message !== "string" || message.length === 0) return "UniFi Site Manager request failed";
  return message.slice(0, 400);
}

export function createMcpServer(api) {
  const server = new Server(
    { name: "unifi-site-manager", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    try {
      const text = await callTool(api, name, args ?? {});
      return { content: [{ type: "text", text }] };
    } catch (err) {
      return { content: [{ type: "text", text: publicErrorText(api, err) }], isError: true };
    }
  });
  return server;
}

async function main() {
  lockdownOutboundEnv();
  let api;
  try {
    api = createApi(createClientFromEnv(process.env));
  } catch (err) {
    console.error(publicErrorText(null, err));
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await createMcpServer(api).connect(transport);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  await main();
}
