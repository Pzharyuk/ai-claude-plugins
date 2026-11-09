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
      const message = err instanceof Error ? err.message : "UniFi Site Manager request failed";
      return { content: [{ type: "text", text: message }], isError: true };
    }
  });
  return server;
}

async function main() {
  let api;
  try {
    api = createApi(createClientFromEnv(process.env));
  } catch (err) {
    console.error(err instanceof Error ? err.message : "UNIFI_SITE_MANAGER_API_KEY is required");
    process.exit(1);
  }
  const transport = new StdioServerTransport();
  await createMcpServer(api).connect(transport);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  await main();
}
