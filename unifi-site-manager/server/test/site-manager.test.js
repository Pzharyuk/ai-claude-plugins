import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, mkdtempSync, writeFileSync, chmodSync, symlinkSync, mkdirSync, rmSync, lstatSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = path.resolve(serverDir, "..");
const repoRoot = path.resolve(pluginDir, "..");

const SECRET = "test-site-manager-key-do-not-log";

const {
  LIMITS,
  MIN_CONSOLE_FIRMWARE,
  API_BASE,
  requireApiKey,
  loadApiKeyFromFile,
  createClientFromEnv,
  redact,
  firmwareStatus,
  firmwareVersionForHost,
  createClient,
  createApi,
  TOOLS,
  callTool,
  API_LIMITATIONS,
} = await import("../lib.js");

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function clock() {
  let t = 1_000_000;
  const sleeps = [];
  return {
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

function client(fetchImpl, limits = {}, time = clock()) {
  return createClient({
    apiKey: SECRET,
    fetchImpl,
    now: time.now,
    sleep: time.sleep,
    limits: { ...LIMITS, minRequestIntervalMs: 0, consoleRequestsPerMinute: 1000, ...limits },
  });
}

describe("requireApiKey", () => {
  it("rejects a missing key without echoing any supplied value", () => {
    assert.throws(
      () => requireApiKey({ UNIFI_SITE_MANAGER_API_KEY: "   " }),
      (err) => {
        assert.equal(err.code, "missing_api_key");
        assert.equal(err.message.includes("   "), false);
        assert.match(err.message, /plugin secret/i);
        return true;
      },
    );
  });

  it("rejects a short key without including the key text", () => {
    assert.throws(
      () => requireApiKey({ UNIFI_SITE_MANAGER_API_KEY: "abc" }),
      (err) => {
        assert.equal(err.code, "invalid_api_key");
        assert.equal(err.message.includes("abc"), false);
        return true;
      },
    );
  });

  it("returns the trimmed key when it is present", () => {
    assert.equal(requireApiKey({ UNIFI_SITE_MANAGER_API_KEY: `  ${SECRET}  ` }), SECRET);
  });
});

describe("redact", () => {
  it("removes credential fields and any copy of the API key", () => {
    const value = redact(
      {
        userData: { email: "person@example.com", role: "owner" },
        note: `leaked ${SECRET}`,
        nested: [{ password: "hunter2", privateKey: "pem", ok: true }],
        token: "session",
      },
      [SECRET],
    );
    const text = JSON.stringify(value);
    assert.equal(text.includes(SECRET), false);
    assert.equal(text.includes("person@example.com"), false);
    assert.equal(text.includes("hunter2"), false);
    assert.equal(text.includes("pem"), false);
    assert.equal(text.includes("session"), false);
    assert.equal(value.userData.role, "owner");
    assert.equal(value.nested[0].ok, true);
  });
});

describe("firmware gate", () => {
  it("accepts 5.0.3 and newer numeric versions only", () => {
    assert.equal(firmwareStatus("5.0.3").state, "ok");
    assert.equal(firmwareStatus("5.0.4").state, "ok");
    assert.equal(firmwareStatus("6.0.0").state, "ok");
    assert.equal(firmwareStatus("5.0.2").state, "unsupported");
    assert.equal(firmwareStatus("4.1.13").state, "unsupported");
    assert.equal(firmwareStatus("5.0").state, "unsupported");
    assert.equal(firmwareStatus("5.0.3-beta").state, "unknown");
    assert.equal(firmwareStatus("v5.1.0").state, "unknown");
    assert.equal(firmwareStatus(null).state, "unknown");
    assert.equal(firmwareStatus("5.0.3").minimum, MIN_CONSOLE_FIRMWARE);
  });

  it("uses the lowest console device version and ignores Network application versions", () => {
    const groups = [
      {
        hostId: "console-a",
        devices: [
          { isConsole: true, version: "5.1.0" },
          { isConsole: true, version: "4.1.13" },
          { isConsole: false, version: "9.9.9" },
        ],
      },
      {
        hostId: "network-server",
        devices: [{ isConsole: false, version: "8.3.11" }],
      },
    ];
    assert.equal(firmwareVersionForHost("console-a", groups), "4.1.13");
    assert.equal(firmwareVersionForHost("network-server", groups), null);
    assert.equal(firmwareVersionForHost("missing", groups), null);
  });
});

describe("site manager pagination", () => {
  it("follows nextToken until the collection is complete", async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      const token = new URL(url).searchParams.get("nextToken");
      seen.push(token);
      if (!token) {
        return jsonResponse(200, { data: [{ id: "h1" }], nextToken: "page-2", httpStatusCode: 200 });
      }
      assert.equal(token, "page-2");
      return jsonResponse(200, { data: [{ id: "h2" }], httpStatusCode: 200 });
    };
    const api = createApi(client(fetchImpl));
    const result = await api.listHosts();
    assert.deepEqual(result.items.map((item) => item.id), ["h1", "h2"]);
    assert.equal(result.pages, 2);
    assert.equal(result.truncated, false);
    assert.deepEqual(seen, [null, "page-2"]);
    const first = new URL(seen.length ? "https://api.ui.com/v1/hosts?pageSize=25" : "");
    assert.equal(first.searchParams.get("pageSize"), "25");
  });

  it("stops at the page bound and reports the resume token", async () => {
    const fetchImpl = async (url) => {
      const token = new URL(url).searchParams.get("nextToken");
      const next = token ? `tok-${Number(token.split("-")[1]) + 1}` : "tok-2";
      return jsonResponse(200, { data: [{ id: token || "tok-1" }], nextToken: next });
    };
    const api = createApi(client(fetchImpl, { siteManagerMaxPages: 2 }));
    const result = await api.listSites();
    assert.equal(result.pages, 2);
    assert.equal(result.truncated, true);
    assert.equal(result.truncationReason, "max_pages");
    assert.equal(result.nextToken, "tok-3");
    assert.equal(result.items.length, 2);
  });

  it("stops when a nextToken repeats", async () => {
    let calls = 0;
    const fetchImpl = async () => {
      calls += 1;
      return jsonResponse(200, { data: [{ id: calls }], nextToken: "again" });
    };
    const api = createApi(client(fetchImpl));
    const result = await api.listDevices();
    assert.equal(calls, 2);
    assert.equal(result.truncated, true);
    assert.equal(result.truncationReason, "repeated_next_token");
  });

  it("clamps pageSize to the client maximum and sends it as a string", async () => {
    let pageSize;
    const fetchImpl = async (url) => {
      pageSize = new URL(url).searchParams.get("pageSize");
      return jsonResponse(200, { data: [] });
    };
    const api = createApi(client(fetchImpl));
    await api.listHosts({ pageSize: 1000 });
    assert.equal(pageSize, String(LIMITS.siteManagerMaxPageSize));
  });

  it("rejects an unsafe host id before any request", async () => {
    let calls = 0;
    const api = createApi(client(async () => {
      calls += 1;
      return jsonResponse(200, {});
    }));
    await assert.rejects(() => api.getHost("../v1/sites"), (err) => err.code === "invalid_input");
    await assert.rejects(() => api.getHost("host/extra"), (err) => err.code === "invalid_input");
    assert.equal(calls, 0);
  });
});

describe("network VPN pagination and per-console errors", () => {
  const hosts = [
    { id: "HOSTLOW:1", owner: true, type: "ucore" },
    { id: "HOSTOK:2", owner: false, type: "ucore" },
    { id: "HOSTPERMS:3", owner: false, type: "ucore" },
  ];
  const devices = [
    { hostId: "HOSTLOW:1", devices: [{ isConsole: true, version: "4.1.13" }] },
    { hostId: "HOSTOK:2", devices: [{ isConsole: true, version: "5.0.3" }] },
    { hostId: "HOSTPERMS:3", devices: [{ isConsole: true, version: "5.2.0" }, { isConsole: true, version: "5.4.1" }] },
  ];

  function router({ okSites = 1, tunnelPages = 1 } = {}) {
    const calls = [];
    const fetchImpl = async (url, init) => {
      const u = new URL(url);
      calls.push({ method: init.method, path: decodeURIComponent(u.pathname), query: u.searchParams });
      if (u.pathname === "/v1/hosts") {
        return jsonResponse(200, { data: hosts });
      }
      if (u.pathname === "/v1/sites") {
        return jsonResponse(200, {
          data: hosts.map((host) => ({
            siteId: `site-${host.id}`,
            hostId: host.id,
            permission: "admin",
            isOwner: host.owner,
            statistics: { percentages: { wanUptime: 100 }, counts: { totalDevice: 1 }, internetIssues: [] },
            meta: { name: "default", desc: host.id },
          })),
        });
      }
      if (u.pathname === "/v1/devices") {
        return jsonResponse(200, { data: devices });
      }
      if (u.pathname.endsWith("/network/integration/v1/sites") && u.pathname.includes("HOSTPERMS")) {
        return jsonResponse(403, {
          code: "forbidden",
          httpStatusCode: 403,
          message: "insufficient permissions or not the owner of the host",
        });
      }
      if (u.pathname.endsWith("/network/integration/v1/sites")) {
        return jsonResponse(200, {
          offset: 0,
          limit: 100,
          count: 1,
          totalCount: 1,
          data: [{ id: "88f7af54-98f8-306a-a1c7-c9349722b1f6", name: "Default" }],
        });
      }
      if (u.pathname.endsWith("/vpn/servers")) {
        return jsonResponse(200, { offset: 0, limit: 100, count: 1, totalCount: 1, data: [{ id: "srv-1", name: "Remote", type: "WIREGUARD", enabled: true }] });
      }
      if (u.pathname.endsWith("/vpn/site-to-site-tunnels")) {
        const offset = Number(u.searchParams.get("offset") || "0");
        if (tunnelPages > 1 && offset === 0) {
          return jsonResponse(200, {
            offset: 0,
            limit: 1,
            count: 1,
            totalCount: 2,
            data: [{ id: "tun-1", name: "Hub", type: "IPSEC" }],
          });
        }
        return jsonResponse(200, {
          offset,
          limit: 1,
          count: 1,
          totalCount: tunnelPages > 1 ? 2 : 1,
          data: [{ id: offset === 0 ? "tun-1" : "tun-2", name: "Spoke", type: "WIREGUARD" }],
        });
      }
      return jsonResponse(500, { message: `unexpected ${u.pathname}` });
    };
    return { calls, fetchImpl, okSites };
  }

  it("skips firmware failures and keeps permission failures beside successful consoles", async () => {
    const { calls, fetchImpl } = router();
    const api = createApi(client(fetchImpl));
    const result = await api.listVpnStatus();
    const byHost = Object.fromEntries(result.hosts.map((host) => [host.hostId, host]));

    assert.equal(byHost["HOSTLOW:1"].ok, false);
    assert.equal(byHost["HOSTLOW:1"].error.code, "firmware_unsupported");
    assert.equal(byHost["HOSTPERMS:3"].ok, false);
    assert.equal(byHost["HOSTPERMS:3"].error.code, "permission_denied");
    assert.equal(byHost["HOSTPERMS:3"].error.status, 403);
    assert.equal(byHost["HOSTOK:2"].ok, true);
    assert.equal(byHost["HOSTOK:2"].sites[0].servers[0].name, "Remote");
    assert.equal(byHost["HOSTOK:2"].sites[0].tunnels[0].id, "tun-1");

    const connectorCalls = calls.filter((call) => call.path.includes("/v1/connector/"));
    assert.equal(connectorCalls.some((call) => call.path.includes("HOSTLOW")), false);
    assert.equal(connectorCalls.some((call) => call.path.includes("HOSTOK")), true);
    assert.equal(connectorCalls.every((call) => call.method === "GET"), true);
    assert.equal(connectorCalls.some((call) => call.path.includes("/protect") || call.path.includes("/access")), false);
    assert.equal(connectorCalls.some((call) => call.path.includes("/vpn/servers")), true);
    assert.equal(connectorCalls.some((call) => call.path.includes("/vpn/site-to-site-tunnels")), true);
  });

  it("pages Network tunnel results up to totalCount and clamps limit to 200", async () => {
    const limitsUsed = [];
    const { fetchImpl } = router({ tunnelPages: 2 });
    const wrapped = async (url, init) => {
      const u = new URL(url);
      if (u.pathname.includes("site-to-site-tunnels")) limitsUsed.push(u.searchParams.get("limit"));
      return fetchImpl(url, init);
    };
    const api = createApi(client(wrapped, { networkDefaultLimit: 1, networkMaxLimit: 200 }));
    const result = await api.listVpnStatus({ hostId: "HOSTOK:2" });
    const tunnels = result.hosts[0].sites[0].tunnels;
    assert.deepEqual(tunnels.map((tunnel) => tunnel.id), ["tun-1", "tun-2"]);
    assert.deepEqual(limitsUsed, ["1", "1"]);

    let sentLimit;
    const apiClamp = createApi(client(async (url, init) => {
      const u = new URL(url);
      if (u.pathname === "/v1/hosts") return jsonResponse(200, { data: [{ id: "HOSTOK:2", owner: true }] });
      if (u.pathname === "/v1/devices") return jsonResponse(200, { data: devices.filter((group) => group.hostId === "HOSTOK:2") });
      if (u.pathname.endsWith("/vpn/servers")) {
        sentLimit = u.searchParams.get("limit");
        return jsonResponse(200, { data: [], totalCount: 0, count: 0, offset: 0, limit: 200 });
      }
      if (u.pathname.endsWith("/network/integration/v1/sites")) {
        return jsonResponse(200, { data: [{ id: "88f7af54-98f8-306a-a1c7-c9349722b1f6" }], totalCount: 1, count: 1 });
      }
      if (u.pathname.endsWith("/vpn/site-to-site-tunnels")) {
        return jsonResponse(200, { data: [], totalCount: 0, count: 0 });
      }
      return jsonResponse(200, { data: [] });
    }));
    await apiClamp.listVpnStatus({ hostId: "HOSTOK:2", limit: 9999 });
    assert.equal(sentLimit, "200");
  });

  it("does not put a non-UUID Network site id into a path", async () => {
    const calls = [];
    const api = createApi(client(async (url, init) => {
      const u = new URL(url);
      calls.push(decodeURIComponent(u.pathname));
      if (u.pathname === "/v1/hosts") return jsonResponse(200, { data: [{ id: "HOSTOK:2", owner: true }] });
      if (u.pathname === "/v1/devices") return jsonResponse(200, { data: [{ hostId: "HOSTOK:2", devices: [{ isConsole: true, version: "5.0.3" }] }] });
      if (u.pathname.endsWith("/network/integration/v1/sites")) {
        return jsonResponse(200, { data: [{ id: "../../admin" }], totalCount: 1, count: 1 });
      }
      return jsonResponse(500, { message: "should not fetch vpn" });
    }));
    const result = await api.listVpnStatus({ hostId: "HOSTOK:2" });
    assert.equal(result.hosts[0].sites[0].ok, false);
    assert.equal(result.hosts[0].sites[0].error.code, "invalid_site_id");
    assert.equal(calls.some((pathname) => pathname.includes("..")), false);
  });
});

describe("rate limits, timeouts, and secret safety", () => {
  it("retries 429 using Retry-After and then returns the redacted body", async () => {
    const time = clock();
    let attempts = 0;
    const fetchImpl = async (url, init) => {
      attempts += 1;
      assert.equal(init.headers["X-API-KEY"], SECRET);
      assert.equal(url.startsWith(`${API_BASE}/`), true);
      assert.equal(url.includes(SECRET), false);
      if (attempts === 1) {
        return jsonResponse(429, { code: "rate_limit", message: `rate limit exceeded ${SECRET}` }, { "retry-after": "2" });
      }
      return jsonResponse(200, { data: [{ id: "cfg-1", name: "WAN" }] });
    };
    const api = createApi(client(fetchImpl, { maxAttempts: 3 }, time));
    const result = await api.listSdWanConfigs();
    assert.equal(attempts, 2);
    assert.deepEqual(time.sleeps, [2000]);
    assert.equal(result[0].id, "cfg-1");
    assert.equal(JSON.stringify(result).includes(SECRET), false);
  });

  it("parses the documented retry-after message and caps a long wait", async () => {
    const time = clock();
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts === 1) {
        return jsonResponse(429, { code: "rate_limit", message: "rate limit exceeded, retry after 5.372786998s" });
      }
      if (attempts === 2) {
        return jsonResponse(429, { code: "rate_limit", message: "retry after 30s" }, { "retry-after": "30" });
      }
      return jsonResponse(200, { data: { id: "sdw-1", name: "Primary", type: "sdwan-hbsp" } });
    };
    const api = createApi(client(fetchImpl, {}, time));
    const result = await api.getSdWanConfig("sdw-1");
    assert.equal(result.id, "sdw-1");
    assert.deepEqual(time.sleeps, [5373, 8000]);
  });

  it("does not retry 401 and strips the key from the error", async () => {
    let attempts = 0;
    const api = createApi(client(async () => {
      attempts += 1;
      return jsonResponse(401, { code: "unauthorized", message: `bad ${SECRET}` });
    }));
    await assert.rejects(() => api.listSdWanConfigs(), (err) => {
      assert.equal(err.status, 401);
      assert.equal(err.code, "unauthorized");
      assert.equal(err.message.includes(SECRET), false);
      return true;
    });
    assert.equal(attempts, 1);
  });

  it("retries a timeout a bounded number of times", async () => {
    const time = clock();
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      const err = new Error("The operation was aborted");
      err.name = "TimeoutError";
      throw err;
    };
    const api = createApi(client(fetchImpl, { maxAttempts: 3 }, time));
    await assert.rejects(() => api.getSdWanStatus("sdw-1"), (err) => {
      assert.equal(err.code, "timeout");
      assert.equal(err.message.includes(SECRET), false);
      return true;
    });
    assert.equal(attempts, 3);
    assert.deepEqual(time.sleeps, [500, 1000]);
  });

  it("refuses an oversized response", async () => {
    const api = createApi(client(async () => jsonResponse(200, { data: "x".repeat(50) }), { maxResponseBytes: 20 }));
    await assert.rejects(() => api.listSdWanConfigs(), (err) => err.code === "response_too_large");
  });

  it("spaces requests for one console under the client budget", async () => {
    const time = clock();
    const api = createApi(client(async (url) => {
      const path = new URL(url).pathname;
      if (path === "/v1/hosts") return jsonResponse(200, { data: [{ id: "HOSTOK:2", owner: true }] });
      if (path === "/v1/devices") return jsonResponse(200, { data: [{ hostId: "HOSTOK:2", devices: [{ isConsole: true, version: "6.0.0" }] }] });
      if (path.endsWith("/network/integration/v1/sites")) {
        return jsonResponse(200, { data: [{ id: "88f7af54-98f8-306a-a1c7-c9349722b1f6" }], totalCount: 1, count: 1 });
      }
      return jsonResponse(200, { data: [{ id: "one" }], totalCount: 1, count: 1 });
    }, { consoleRequestsPerMinute: 2, minRequestIntervalMs: 0 }, time));
    await api.listVpnStatus({ hostId: "HOSTOK:2" });
    assert.ok(time.sleeps.some((ms) => ms >= 60_000));
  });
});

describe("ISP metrics and SD-WAN reads", () => {
  it("rejects duration combined with timestamps and wrong intervals", async () => {
    let calls = 0;
    const api = createApi(client(async () => {
      calls += 1;
      return jsonResponse(200, { data: [] });
    }));
    await assert.rejects(
      () => api.getIspMetrics({ type: "5m", duration: "24h", beginTimestamp: "2024-06-30T13:35:00Z" }),
      (err) => err.code === "invalid_input",
    );
    await assert.rejects(() => api.getIspMetrics({ type: "1h", duration: "24h" }), (err) => err.code === "invalid_input");
    await assert.rejects(() => api.getIspMetrics({ type: "1d" }), (err) => err.code === "invalid_input");
    assert.equal(calls, 0);
  });

  it("queries selected sites with POST and preserves partial success", async () => {
    let body;
    let method;
    const api = createApi(client(async (url, init) => {
      method = init.method;
      body = JSON.parse(init.body);
      assert.equal(new URL(url).pathname, "/v1/isp-metrics/5m/query");
      return jsonResponse(200, {
        data: {
          status: "partialSuccess",
          message: "some of the requested sites are not accessible",
          metrics: [{ hostId: "HOSTOK:2", siteId: "661900ae6aec8f548d49fd54", metricType: "5m", periods: [] }],
        },
      });
    }));
    const result = await api.queryIspMetrics({
      type: "5m",
      sites: [{ hostId: "HOSTOK:2", siteId: "661900ae6aec8f548d49fd54", beginTimestamp: "2024-06-30T13:35:00Z", endTimestamp: "2024-06-30T15:35:00Z" }],
    });
    assert.equal(method, "POST");
    assert.equal(body.sites[0].hostId, "HOSTOK:2");
    assert.equal(result.status, "partialSuccess");
    assert.equal(result.metrics.length, 1);
  });
});

describe("tools stay read-only", () => {
  it("lists only documented read tools and states that VPN writes do not exist", () => {
    const names = TOOLS.map((tool) => tool.name);
    assert.deepEqual(names, [
      "unifi_sm_list_hosts",
      "unifi_sm_get_host",
      "unifi_sm_list_sites",
      "unifi_sm_list_site_health",
      "unifi_sm_list_devices",
      "unifi_sm_discover_locations",
      "unifi_sm_get_isp_metrics",
      "unifi_sm_query_isp_metrics",
      "unifi_sm_list_sdwan_configs",
      "unifi_sm_get_sdwan_config",
      "unifi_sm_get_sdwan_status",
      "unifi_sm_list_vpn_status",
      "unifi_sm_api_limitations",
    ]);
    for (const tool of TOOLS) {
      assert.equal(/create|update|delete|patch|adopt|restart|block|proxy/i.test(tool.name), false);
    }
    assert.equal(API_LIMITATIONS.vpn.writesExposed, false);
    assert.deepEqual(API_LIMITATIONS.vpn.documentedMethods, ["GET"]);
    assert.equal(API_LIMITATIONS.minimumConsoleFirmware, "5.0.3");
    assert.equal(API_LIMITATIONS.protectOrAccess, false);
  });

  it("returns limitations without calling the network", async () => {
    let calls = 0;
    const api = createApi(client(async () => {
      calls += 1;
      return jsonResponse(500, {});
    }));
    const text = await callTool(api, "unifi_sm_api_limitations", {});
    assert.equal(calls, 0);
    assert.match(text, /GET only/);
    assert.equal(text.includes(SECRET), false);
  });
});

describe("repository secret safety", () => {
  const skip = new Set(["node_modules", "test"]);

  function files(dir) {
    const out = [];
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const full = path.join(dir, name);
      const stat = statSync(full);
      if (stat.isDirectory()) out.push(...files(full));
      else if (/\.(js|md|json)$/.test(name)) out.push(full);
    }
    return out;
  }

  it("does not hardcode a credential or tell the operator to paste one into chat", () => {
    const sources = files(pluginDir).map((file) => readFileSync(file, "utf8")).join("\n");
    assert.equal(sources.includes(SECRET), false);
    assert.equal(/X-API-KEY["']?\s*[:=]\s*["'][A-Za-z0-9]{8,}["']/.test(sources), false);
    assert.equal(/What is your (UniFi |Site Manager )?API key/i.test(sources), false);
    assert.match(sources, /Do not paste/i);
    assert.match(sources, /UNIFI_SITE_MANAGER_API_KEY/);
  });

  it("leaves the local unifi-network plugin untouched", () => {
    const network = readFileSync(path.join(repoRoot, "unifi-network/.claude-plugin/plugin.json"), "utf8");
    assert.match(network, /"name": "unifi-network"/);
    assert.match(network, /UNIFI_PASSWORD/);
  });
});

describe("redirects, allowlist, and page bounds", () => {
  it("blocks redirects and does not request the Location host", async () => {
    const calls = [];
    const api = createApi(client(async (url, init) => {
      calls.push({ url, redirect: init.redirect });
      return new Response("go", { status: 302, headers: { Location: "https://evil.example/steal", "x-api-key": SECRET } });
    }));
    await assert.rejects(() => api.listSdWanConfigs(), (err) => {
      assert.equal(err.code, "redirect_blocked");
      assert.equal(err.message.includes("evil.example"), false);
      assert.equal(err.message.includes(SECRET), false);
      assert.equal(err.message.includes("Location"), false);
      return true;
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].redirect, "manual");
    assert.equal(String(calls[0].url).startsWith("https://api.ui.com/"), true);
  });

  it("rejects an off-host final URL even when the status is 200", async () => {
    const api = createApi(client(async () => ({
      status: 200,
      ok: true,
      url: "https://evil.example/v1/sd-wan-configs",
      headers: new Headers(),
      arrayBuffer: async () => new TextEncoder().encode("{}"),
    })));
    await assert.rejects(() => api.listSdWanConfigs(), (err) => {
      assert.equal(err.code, "redirect_blocked");
      assert.equal(err.message.includes("evil.example"), false);
      return true;
    });
  });

  it("rejects off-host, protect, mutating, and unknown query requests before fetch", async () => {
    let calls = 0;
    const raw = client(async () => {
      calls += 1;
      return jsonResponse(200, { data: [] });
    });
    await assert.rejects(() => raw.request("GET", "https://evil.example/v1/hosts"), (err) => err.code === "invalid_input");
    await assert.rejects(() => raw.request("GET", "//evil.example/v1/hosts"), (err) => err.code === "invalid_input");
    await assert.rejects(() => raw.request("GET", "/v1/connector/consoles/HOST/protect/integration/v1/cameras"), (err) => err.code === "invalid_input");
    await assert.rejects(() => raw.request("POST", "/v1/hosts"), (err) => err.code === "invalid_input");
    await assert.rejects(() => raw.request("DELETE", "/v1/hosts/HOSTOK:1"), (err) => err.code === "invalid_input");
    await assert.rejects(() => raw.request("GET", "/v1/hosts", { query: { next: "https://evil.example" } }), (err) => err.code === "invalid_input");
    assert.equal(calls, 0);
  });

  it("clamps maxPages to the client bound", async () => {
    let calls = 0;
    const api = createApi(client(async () => {
      calls += 1;
      return jsonResponse(200, { data: [{ id: calls }], nextToken: `tok-${calls}` });
    }));
    const result = await api.listHosts({ maxPages: 1000 });
    assert.equal(calls, LIMITS.siteManagerMaxPages);
    assert.equal(result.truncated, true);
    assert.equal(result.truncationReason, "max_pages");
  });

  it("starts a later page from a safe nextToken", async () => {
    let token;
    const api = createApi(client(async (url) => {
      token = new URL(url).searchParams.get("nextToken");
      return jsonResponse(200, { data: [{ id: "h2" }] });
    }));
    const result = await api.listHosts({ nextToken: "page-2" });
    assert.equal(token, "page-2");
    assert.equal(result.items[0].id, "h2");
    let calls = 0;
    const blocked = createApi(client(async () => {
      calls += 1;
      return jsonResponse(200, { data: [] });
    }));
    await assert.rejects(() => blocked.listHosts({ nextToken: "../token" }), (err) => err.code === "invalid_input");
    assert.equal(calls, 0);
  });

  it("reports a host that is absent instead of an empty VPN success", async () => {
    const calls = [];
    const api = createApi(client(async (url) => {
      const pathname = new URL(url).pathname;
      calls.push(pathname);
      if (pathname === "/v1/hosts") return jsonResponse(200, { data: [{ id: "OTHER:1", owner: true }] });
      if (pathname === "/v1/devices") return jsonResponse(200, { data: [] });
      return jsonResponse(500, { message: "connector should not be called" });
    }));
    const result = await api.listVpnStatus({ hostId: "HOSTOK:2" });
    assert.equal(result.hosts[0].ok, false);
    assert.equal(result.hosts[0].error.code, "not_found");
    assert.equal(calls.some((pathname) => pathname.includes("connector")), false);
  });
});

describe("api key file", () => {
  const marker = "unifi-sm-keyfile-test-marker";
  let dir;

  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), `${marker}-`));
  });

  after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function writeKey(name, contents, mode = 0o600) {
    const file = path.join(dir, name);
    writeFileSync(file, contents);
    chmodSync(file, mode);
    return file;
  }

  function assertHidden(err) {
    assert.equal(err.message.includes(SECRET), false);
    assert.equal(err.message.includes(marker), false);
    assert.equal(err.message.includes(dir), false);
  }

  it("rejects a relative path, a symlink, a loose mode, and a missing file without leaking the path", () => {
    assert.throws(() => loadApiKeyFromFile(`${marker}/key`), (err) => {
      assert.equal(err.code, "invalid_key_file");
      assertHidden(err);
      return true;
    });
    const real = writeKey("real-key", SECRET, 0o600);
    const link = path.join(dir, "key-link");
    symlinkSync(real, link);
    assert.throws(() => loadApiKeyFromFile(link), (err) => {
      assert.equal(err.code, "invalid_key_file");
      assertHidden(err);
      return true;
    });
    const loose = writeKey("loose-key", SECRET, 0o644);
    assert.throws(() => loadApiKeyFromFile(loose), (err) => {
      assert.equal(err.code, "invalid_key_file");
      assertHidden(err);
      return true;
    });
    const execBit = writeKey("exec-key", SECRET, 0o700);
    assert.throws(() => loadApiKeyFromFile(execBit), (err) => err.code === "invalid_key_file");
    assert.throws(() => loadApiKeyFromFile(path.join(dir, "missing-key")), (err) => {
      assert.equal(err.code, "invalid_key_file");
      assertHidden(err);
      return true;
    });
    assert.throws(() => loadApiKeyFromFile(dir), (err) => err.code === "invalid_key_file");
  });

  it("rejects a symlink in a parent directory", () => {
    const realDir = path.join(dir, "real-dir");
    mkdirSync(realDir);
    const file = path.join(realDir, "key");
    writeFileSync(file, SECRET);
    chmodSync(file, 0o600);
    const linkedDir = path.join(dir, "linked-dir");
    symlinkSync(realDir, linkedDir);
    assert.throws(() => loadApiKeyFromFile(path.join(linkedDir, "key")), (err) => {
      assert.equal(err.code, "invalid_key_file");
      assert.equal(err.message.includes("linked-dir"), false);
      assert.equal(lstatSync(linkedDir).isSymbolicLink(), true);
      return true;
    });
  });

  it("reads an owner-only 0600 or 0400 file once and keeps that key in memory", async () => {
    const file = writeKey("memory-key", SECRET, 0o600);
    const time = clock();
    let header;
    const api = createApi(createClientFromEnv(
      { UNIFI_SITE_MANAGER_API_KEY_FILE: file },
      {
        fetchImpl: async (_url, init) => {
          header = init.headers["X-API-KEY"];
          return jsonResponse(200, { data: [{ id: "cfg" }] });
        },
        now: time.now,
        sleep: time.sleep,
        limits: { ...LIMITS, minRequestIntervalMs: 0 },
      },
    ));
    await api.listSdWanConfigs();
    assert.equal(header, SECRET);
    writeFileSync(file, "replacement-key-value-not-used");
    chmodSync(file, 0o600);
    await api.listSdWanConfigs();
    assert.equal(header, SECRET);
    const readonly = writeKey("readonly-key", SECRET, 0o400);
    assert.equal(requireApiKey({ UNIFI_SITE_MANAGER_API_KEY_FILE: readonly }), SECRET);
  });

  it("rejects empty, newline, and oversized file contents without echoing them", () => {
    const empty = writeKey("empty-key", "", 0o600);
    assert.throws(() => loadApiKeyFromFile(empty), (err) => {
      assert.equal(err.code, "invalid_key_file");
      assertHidden(err);
      return true;
    });
    const newline = writeKey("newline-key", `${SECRET}\n`, 0o600);
    assert.throws(() => loadApiKeyFromFile(newline), (err) => {
      assert.equal(err.code, "invalid_api_key");
      assertHidden(err);
      return true;
    });
    const huge = writeKey("huge-key", "a".repeat(513), 0o600);
    assert.throws(() => loadApiKeyFromFile(huge), (err) => {
      assert.equal(err.code, "invalid_key_file");
      assert.equal(err.message.includes("a".repeat(20)), false);
      return true;
    });
  });

  it("refuses to use both the env key and the key file", () => {
    const file = writeKey("both-key", SECRET, 0o600);
    assert.throws(() => requireApiKey({
      UNIFI_SITE_MANAGER_API_KEY: SECRET,
      UNIFI_SITE_MANAGER_API_KEY_FILE: file,
    }), (err) => {
      assert.equal(err.code, "credential_source_conflict");
      assertHidden(err);
      assert.equal(err.message.includes("both-key"), false);
      return true;
    });
    assert.throws(() => requireApiKey({
      UNIFI_SITE_MANAGER_API_KEY: SECRET,
      UNIFI_SITE_MANAGER_API_KEY_FILE: `/${marker}/does-not-exist`,
    }), (err) => {
      assert.equal(err.code, "credential_source_conflict");
      assertHidden(err);
      return true;
    });
  });

  it("rejects a header-breaking env key without echoing it", () => {
    const injected = `abcdefghijklmnopqrstuvwxyz\r\nX-Injected: yes`;
    assert.throws(() => requireApiKey({ UNIFI_SITE_MANAGER_API_KEY: injected }), (err) => {
      assert.equal(err.code, "invalid_api_key");
      assert.equal(err.message.includes("X-Injected"), false);
      assert.equal(err.message.includes("abcdefghijklmnopqrstuvwxyz"), false);
      return true;
    });
  });
});

describe("fixed cloud base URL", () => {
  let previous;
  before(() => {
    previous = process.env.UNIFI_SITE_MANAGER_API_KEY;
    process.env.UNIFI_SITE_MANAGER_API_KEY = SECRET;
    process.env.UNIFI_SITE_MANAGER_BASE_URL = "https://evil.example";
    process.env.UNIFI_HOST = "https://evil.example";
  });
  after(() => {
    if (previous === undefined) delete process.env.UNIFI_SITE_MANAGER_API_KEY;
    else process.env.UNIFI_SITE_MANAGER_API_KEY = previous;
    delete process.env.UNIFI_SITE_MANAGER_BASE_URL;
    delete process.env.UNIFI_HOST;
  });

  it("ignores base URL overrides from the environment", async () => {
    const { createClientFromEnv } = await import("../lib.js");
    let requested;
    const time = clock();
    const apiClient = createClientFromEnv(process.env, {
      fetchImpl: async (url) => {
        requested = url;
        return jsonResponse(200, { data: [] });
      },
      now: time.now,
      sleep: time.sleep,
      limits: { ...LIMITS, minRequestIntervalMs: 0 },
    });
    await createApi(apiClient).listSdWanConfigs();
    assert.equal(requested.startsWith("https://api.ui.com/v1/sd-wan-configs"), true);
    assert.equal(requested.includes("evil.example"), false);
  });
});
