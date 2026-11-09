import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(serverDir, "index.js");
const SECRET = "test-site-manager-key-do-not-log";
const MARKER = "unifi-sm-smoke-marker";

function writeFixture(logPath) {
  const file = path.join(path.dirname(logPath), "fixture-fetch.mjs");
  writeFileSync(file, `
import { appendFileSync } from "node:fs";
const log = process.env.FIXTURE_LOG;
globalThis.fetch = async (url, init) => {
  const parsed = new URL(url);
  const headers = init?.headers || {};
  appendFileSync(log, JSON.stringify({
    protocol: parsed.protocol,
    hostname: parsed.hostname,
    pathname: parsed.pathname,
    redirect: init?.redirect ?? null,
    method: init?.method ?? "GET",
    hasKeyHeader: Object.prototype.hasOwnProperty.call(headers, "X-API-KEY"),
  }) + "\\n");
  if (parsed.hostname !== "api.ui.com" || parsed.protocol !== "https:") {
    return new Response("off-host", { status: 500 });
  }
  if (parsed.pathname === "/v1/sd-wan-configs") {
    return new Response("go", { status: 302, headers: { Location: "https://evil.example/steal" } });
  }
  if (parsed.pathname === "/v1/hosts") {
    return new Response(JSON.stringify({ data: [{ id: "HOSTOK:1", owner: true, type: "ucore" }], httpStatusCode: 200 }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { "content-type": "application/json" } });
};
`);
  return file;
}

function frame(message) {
  return `${JSON.stringify(message)}\n`;
}

function talk(env) {
  const dir = mkdtempSync(path.join(tmpdir(), `${MARKER}-`));
  const logPath = path.join(dir, "calls.ndjson");
  writeFileSync(logPath, "");
  const fixture = writeFixture(logPath);
  const child = spawn(process.execPath, ["--import", fixture, indexPath], {
    env: { ...env, FIXTURE_LOG: logPath },
    stdio: ["pipe", "pipe", "pipe"],
  });
  child.stdin.write(frame({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke", version: "0.0.0" },
    },
  }));
  child.stdin.write(frame({ jsonrpc: "2.0", method: "notifications/initialized" }));
  child.stdin.write(frame({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));
  child.stdin.write(frame({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "unifi_sm_list_hosts", arguments: {} } }));
  child.stdin.write(frame({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "unifi_sm_list_sdwan_configs", arguments: {} } }));
  child.stdin.write(frame({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "unifi_sm_get_host", arguments: { id: "../etc/passwd" } } }));
  child.stdin.end();

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("MCP smoke timed out"));
    }, 8000);
    const ready = () => {
      try {
        const ids = messages(stdout).map((message) => message.id).filter((id) => id != null);
        return [1, 2, 3, 4, 5].every((id) => ids.includes(id));
      } catch {
        return false;
      }
    };
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
      if (ready()) child.kill("SIGTERM");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", () => {
      clearTimeout(timer);
      let calls = [];
      try {
        calls = readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
      } catch {
        calls = [];
      }
      rmSync(dir, { recursive: true, force: true });
      resolve({ stdout, stderr, calls });
    });
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function messages(stdout) {
  return stdout.split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

const dirs = [];

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

describe("black-box MCP smoke", () => {
  async function assertSession(label, env) {
    const result = await talk(env);
    const combined = `${result.stdout}\n${result.stderr}`;
    assert.equal(combined.includes(SECRET), false, `${label} leaked the fixture key`);
    assert.equal(combined.includes("evil.example"), false, `${label} leaked a redirect target`);
    assert.equal(combined.includes(MARKER), false, `${label} leaked the key-file directory`);
    const replies = messages(result.stdout);
    const init = replies.find((message) => message.id === 1);
    assert.equal(init.result.serverInfo.name, "unifi-site-manager");
    assert.equal(typeof init.result.protocolVersion, "string");
    assert.equal(init.result.capabilities.tools !== undefined, true);
    const listed = replies.find((message) => message.id === 2);
    const names = listed.result.tools.map((tool) => tool.name);
    assert.equal(names.length, 13);
    assert.equal(names.some((name) => /create|update|delete|patch|adopt|restart|block|proxy/i.test(name)), false);
    const hosts = replies.find((message) => message.id === 3);
    assert.equal(Boolean(hosts.result.isError), false);
    assert.match(hosts.result.content[0].text, /HOSTOK:1/);
    const redirected = replies.find((message) => message.id === 4);
    assert.equal(redirected.result.isError, true);
    assert.match(redirected.result.content[0].text, /redirect was blocked/);
    const badId = replies.find((message) => message.id === 5);
    assert.equal(badId.result.isError, true);
    assert.equal(badId.result.content[0].text.includes("passwd"), false);
    assert.equal(result.calls.length >= 2, true);
    assert.equal(result.calls.every((call) => call.protocol === "https:" && call.hostname === "api.ui.com"), true);
    assert.equal(result.calls.every((call) => call.redirect === "manual" && call.hasKeyHeader === true), true);
    assert.equal(result.calls.some((call) => call.pathname.includes("protect") || call.pathname.includes("access")), false);
    return { names, protocolVersion: init.result.protocolVersion, calls: result.calls.length };
  }

  it("speaks initialize, tools/list, and tools/call with an env key", async () => {
    const summary = await assertSession("env", {
      PATH: "/usr/bin:/bin",
      UNIFI_SITE_MANAGER_API_KEY: SECRET,
      HTTPS_PROXY: "http://127.0.0.1:9",
      NODE_USE_ENV_PROXY: "1",
    });
    assert.equal(summary.names.includes("unifi_sm_api_limitations"), true);
  });

  it("speaks the same session when the key is only in an owner-only file", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), `${MARKER}-file-`));
    dirs.push(dir);
    const file = path.join(dir, "key");
    writeFileSync(file, SECRET);
    chmodSync(file, 0o600);
    await assertSession("file", {
      PATH: "/usr/bin:/bin",
      UNIFI_SITE_MANAGER_API_KEY_FILE: file,
    });
  });
});
