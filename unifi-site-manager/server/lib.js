/**
 * Read-only UniFi Site Manager client.
 *
 * Official sources checked for this implementation:
 * - https://developer.ui.com/llms.txt
 * - https://developer.ui.com/site-manager/v1.0.0/openapi.json (v1.0.0)
 * - https://developer.ui.com/network/v11.0.97/openapi.json (v11.0.97)
 *
 * Cloud Connector GET is used only for the documented Network paths
 * /v1/sites, /v1/sites/{siteId}/vpn/servers, and
 * /v1/sites/{siteId}/vpn/site-to-site-tunnels. Those VPN routes are GET-only.
 */

export const API_BASE = "https://api.ui.com";
export const MIN_CONSOLE_FIRMWARE = "5.0.3";

export const LIMITS = Object.freeze({
  siteManagerDefaultPageSize: 25,
  siteManagerMaxPageSize: 100,
  siteManagerMaxPages: 20,
  networkDefaultLimit: 100,
  networkMaxLimit: 200,
  networkMaxPages: 20,
  requestTimeoutMs: 20_000,
  maxAttempts: 3,
  consoleRequestsPerMinute: 50,
  minRequestIntervalMs: 250,
  maxResponseBytes: 10 * 1024 * 1024,
  maxRetryWaitMs: 8_000,
  maxQuerySites: 25,
  maxHostIds: 20,
});

const SAFE_ID = /^[A-Za-z0-9:._-]{1,200}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const SENSITIVE_KEY = /^(password|passwd|secret|apiKey|api_key|x-api-key|authorization|cookie|set-cookie|privateKey|private_key|presharedKey|preSharedKey|psk|passphrase|credential|credentials|token|accessToken|refreshToken|email|phone)$/i;

export const API_LIMITATIONS = {
  sources: {
    index: "https://developer.ui.com/llms.txt",
    siteManagerOpenApi: "https://developer.ui.com/site-manager/v1.0.0/openapi.json",
    networkOpenApi: "https://developer.ui.com/network/v11.0.97/openapi.json",
  },
  baseUrl: API_BASE,
  authHeader: "X-API-KEY",
  minimumConsoleFirmware: MIN_CONSOLE_FIRMWARE,
  protectOrAccess: false,
  officialConnector: {
    requestsPerMinutePerConsole: 100,
    timeoutSeconds: 25,
    maxResponseBytes: 10 * 1024 * 1024,
    nonOrganizationKeys: "owner consoles only",
    organizationKeys: "any console in the organization",
    permissionError: "HTTP 403: insufficient permissions or not the owner of the host",
    firmwareField: "Console device version from GET /v1/devices where isConsole is true. Host reportedState.version in the network-server example is the Network application version, not UniFi OS firmware, and is not used for this gate.",
  },
  clientGuards: {
    requestsPerMinutePerConsole: LIMITS.consoleRequestsPerMinute,
    minIntervalMs: LIMITS.minRequestIntervalMs,
    timeoutMs: LIMITS.requestTimeoutMs,
    maxAttempts: LIMITS.maxAttempts,
    maxRetryWaitMs: LIMITS.maxRetryWaitMs,
    siteManagerMaxPageSize: LIMITS.siteManagerMaxPageSize,
    siteManagerMaxPages: LIMITS.siteManagerMaxPages,
    networkMaxLimit: LIMITS.networkMaxLimit,
    networkMaxPages: LIMITS.networkMaxPages,
    maxQuerySites: LIMITS.maxQuerySites,
  },
  pagination: {
    siteManager: "GET /v1/hosts, /v1/sites, and /v1/devices use pageSize plus nextToken. OpenAPI does not document a numeric pageSize maximum (the example is 10). This client caps pageSize at 100 and follows at most 20 pages.",
    network: "Network list routes use offset and limit. The documented limit maximum is 200. This client follows at most 20 pages.",
  },
  vpn: {
    writesExposed: false,
    documentedMethods: ["GET"],
    paths: [
      "GET /v1/sites/{siteId}/vpn/servers",
      "GET /v1/sites/{siteId}/vpn/site-to-site-tunnels",
    ],
    note: "Network OpenAPI v11.0.97 documents these VPN routes as GET only. This plugin does not create, update, or delete VPN peers.",
  },
  ispQuery: "POST /v1/isp-metrics/{type}/query is a read query, not a configuration change. Partial access returns HTTP 200 with status partialSuccess. The description says no access to the requested sites returns HTTP 502.",
  notImplemented: {
    siteManagerWrites: "Site Manager v1.0.0 documents no create, update, or delete for hosts, sites, devices, or SD-WAN configs.",
    connectorMutations: "Cloud Connector documents POST, PUT, PATCH, and DELETE proxying. This plugin does not expose those methods or an arbitrary path parameter.",
    networkConfiguration: "Network documents writes for firewall policies and zones, networks, WiFi broadcasts, ACL rules, DNS policies, traffic matching lists, device adoption, client actions, and hotspot vouchers. None of those writes are exposed.",
    vpnPeers: "No documented write for VPN servers or site-to-site tunnels exists in Network OpenAPI v11.0.97.",
    protectAndAccess: "Protect and Access are out of scope, including their Cloud Connector paths.",
  },
};

export class ApiError extends Error {
  constructor(message, { status = null, code = "request_failed" } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function requireApiKey(env = process.env) {
  const raw = env?.UNIFI_SITE_MANAGER_API_KEY;
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new ApiError(
      "UNIFI_SITE_MANAGER_API_KEY is required. Set it in the plugin secret field. Do not paste it into chat.",
      { code: "missing_api_key" },
    );
  }
  const key = raw.trim();
  if (key.length < 16 || key.length > 512 || /\s/.test(key)) {
    throw new ApiError(
      "UNIFI_SITE_MANAGER_API_KEY is not a usable secret. Set a new key in the plugin secret field.",
      { code: "invalid_api_key" },
    );
  }
  return key;
}

export function redact(value, secrets = []) {
  const secretList = secrets.filter((secret) => typeof secret === "string" && secret.length >= 8);
  const scrub = (text) => secretList.reduce((current, secret) => current.split(secret).join("[redacted]"), text);
  const walk = (input, keyName) => {
    if (keyName && SENSITIVE_KEY.test(keyName)) return "[redacted]";
    if (typeof input === "string") return scrub(input);
    if (Array.isArray(input)) return input.map((item) => walk(item));
    if (input && typeof input === "object") {
      const out = {};
      for (const [key, child] of Object.entries(input)) out[key] = walk(child, key);
      return out;
    }
    return input;
  };
  return walk(value);
}

function parseVersion(version) {
  if (typeof version !== "string" || !/^\d+(\.\d+){0,3}$/.test(version)) return null;
  return version.split(".").map((part) => Number(part));
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function firmwareStatus(version, minimum = MIN_CONSOLE_FIRMWARE) {
  if (version == null || version === "") return { state: "unknown", version: null, minimum };
  const text = String(version).trim();
  if (!parseVersion(text)) return { state: "unknown", version: text, minimum };
  return {
    state: compareVersions(text, minimum) >= 0 ? "ok" : "unsupported",
    version: text,
    minimum,
  };
}

export function firmwareVersionForHost(hostId, deviceGroups) {
  const group = (deviceGroups || []).find((item) => item && item.hostId === hostId);
  if (!group) return null;
  const versions = (group.devices || [])
    .filter((device) => device && device.isConsole === true && typeof device.version === "string" && device.version.trim())
    .map((device) => device.version.trim());
  if (versions.length === 0) return null;
  const unparsed = versions.find((version) => !parseVersion(version));
  if (unparsed) return unparsed;
  return versions.slice().sort((left, right) => compareVersions(left, right))[0];
}

export function assertSafeId(id, label = "id") {
  if (typeof id !== "string" || !SAFE_ID.test(id) || id.includes("..")) {
    throw new ApiError(`${label} is not a safe identifier`, { code: "invalid_input" });
  }
  return id;
}

function encodeId(id) {
  return encodeURIComponent(id).replace(/%3A/gi, ":");
}

function errorInfo(err) {
  return {
    code: err?.code || "request_failed",
    status: err?.status ?? null,
    message: typeof err?.message === "string" ? err.message : "UniFi Site Manager request failed",
  };
}

function assertIspType(type) {
  if (type !== "5m" && type !== "1h") {
    throw new ApiError("ISP metric type must be 5m or 1h", { code: "invalid_input" });
  }
}

function validateIspRange({ type, beginTimestamp, endTimestamp, duration }) {
  assertIspType(type);
  if (duration && (beginTimestamp || endTimestamp)) {
    throw new ApiError("duration cannot be combined with beginTimestamp or endTimestamp", { code: "invalid_input" });
  }
  if (duration) {
    const allowed = type === "5m" ? ["24h"] : ["7d", "30d"];
    if (!allowed.includes(duration)) {
      throw new ApiError("duration is not valid for this metric interval", { code: "invalid_input" });
    }
  }
  if ((beginTimestamp && !endTimestamp) || (!beginTimestamp && endTimestamp)) {
    throw new ApiError("beginTimestamp and endTimestamp must be provided together", { code: "invalid_input" });
  }
  for (const stamp of [beginTimestamp, endTimestamp]) {
    if (stamp && !RFC3339.test(stamp)) {
      throw new ApiError("timestamps must be RFC3339 UTC", { code: "invalid_input" });
    }
  }
}

class RateLimiter {
  constructor({ now, sleep, minIntervalMs, perMinute }) {
    this.now = now;
    this.sleep = sleep;
    this.minIntervalMs = minIntervalMs;
    this.perMinute = perMinute;
    this.lastAt = 0;
    this.hits = new Map();
  }

  async wait(consoleId) {
    for (;;) {
      const now = this.now();
      let delay = 0;
      if (this.minIntervalMs > 0 && this.lastAt && now - this.lastAt < this.minIntervalMs) {
        delay = Math.max(delay, this.minIntervalMs - (now - this.lastAt));
      }
      if (consoleId && this.perMinute > 0) {
        const recent = (this.hits.get(consoleId) || []).filter((stamp) => now - stamp < 60_000);
        this.hits.set(consoleId, recent);
        if (recent.length >= this.perMinute) {
          delay = Math.max(delay, 60_000 - (now - recent[0]));
        }
      }
      if (!Number.isFinite(delay) || delay <= 0) break;
      await this.sleep(delay);
    }
    const now = this.now();
    this.lastAt = now;
    if (consoleId && this.perMinute > 0) {
      const recent = this.hits.get(consoleId) || [];
      recent.push(now);
      this.hits.set(consoleId, recent);
    }
  }
}

function isTimeout(err) {
  return err?.name === "TimeoutError" || err?.name === "AbortError" || err?.code === "ABORT_ERR";
}

export function createClient({
  apiKey,
  fetchImpl = globalThis.fetch,
  now = () => Date.now(),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  limits: limitOverrides = {},
} = {}) {
  if (typeof apiKey !== "string" || apiKey.length < 16) {
    throw new ApiError("A Site Manager API key is required", { code: "missing_api_key" });
  }
  const limits = { ...LIMITS, ...limitOverrides };
  const limiter = new RateLimiter({
    now,
    sleep,
    minIntervalMs: limits.minRequestIntervalMs,
    perMinute: limits.consoleRequestsPerMinute,
  });

  const retryDelay = (response, payload, attempt) => {
    const header = response.headers.get("retry-after");
    if (header && /^\d+(\.\d+)?$/.test(header.trim())) {
      return Math.min(limits.maxRetryWaitMs, Math.ceil(Number(header) * 1000));
    }
    const message = typeof payload?.message === "string" ? payload.message : "";
    const match = message.match(/retry after ([0-9]+(?:\.[0-9]+)?)s/i);
    if (match) return Math.min(limits.maxRetryWaitMs, Math.ceil(Number(match[1]) * 1000));
    return Math.min(limits.maxRetryWaitMs, 500 * 2 ** (attempt - 1));
  };

  const readBody = async (response) => {
    const declared = response.headers.get("content-length");
    if (declared && Number(declared) > limits.maxResponseBytes) {
      throw new ApiError("UniFi Site Manager response exceeds the 10 MB limit", { code: "response_too_large" });
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > limits.maxResponseBytes) {
      throw new ApiError("UniFi Site Manager response exceeds the 10 MB limit", { code: "response_too_large" });
    }
    if (buffer.byteLength === 0) return null;
    const text = new TextDecoder().decode(buffer);
    try {
      return JSON.parse(text);
    } catch {
      return { message: text.slice(0, 200) };
    }
  };

  const httpError = (status, payload) => {
    const upstreamCode = typeof payload?.code === "string" ? payload.code : "";
    let code = upstreamCode || "request_failed";
    if (status === 401) code = "unauthorized";
    else if (status === 403) code = "permission_denied";
    else if (status === 404) code = "not_found";
    else if (status === 408) code = "timeout";
    else if (status === 429) code = "rate_limited";
    else if (status === 400) code = "bad_request";
    const upstream = typeof payload?.message === "string" ? redact(payload.message, [apiKey]) : "";
    const message = `UniFi Site Manager HTTP ${status}${upstream ? `: ${upstream}` : ""}`;
    return new ApiError(message, { status, code });
  };

  const fetchWithTimeout = async (url, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), limits.requestTimeoutMs);
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (err) {
      if (err?.name === "AbortError") {
        const timeout = new Error("UniFi Site Manager request timed out");
        timeout.name = "TimeoutError";
        timeout.code = "timeout";
        throw timeout;
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };

  const request = async (method, path, { query, body, consoleId } = {}) => {
    if (method !== "GET" && method !== "POST") {
      throw new ApiError("Only documented read requests are allowed", { code: "invalid_input" });
    }
    const url = new URL(path, API_BASE);
    for (const [key, value] of Object.entries(query || {})) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const item of value) url.searchParams.append(key, String(item));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
    if (url.origin !== API_BASE) {
      throw new ApiError("Requests are limited to the official Site Manager host", { code: "invalid_input" });
    }
    const headers = { Accept: "application/json", "X-API-KEY": apiKey };
    const init = { method, headers };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(body);
    }

    for (let attempt = 1; attempt <= limits.maxAttempts; attempt += 1) {
      try {
        await limiter.wait(consoleId);
        const response = await fetchWithTimeout(url.toString(), init);
        const payload = await readBody(response);
        if (response.ok) return redact(payload ?? {}, [apiKey]);
        const error = httpError(response.status, payload);
        const retryable = response.status === 429 || response.status === 408 || response.status === 502;
        if (!retryable || attempt === limits.maxAttempts) throw error;
        await sleep(retryDelay(response, payload, attempt));
      } catch (err) {
        if (err instanceof ApiError || err?.code === "response_too_large") throw err;
        if (!(isTimeout(err) || err instanceof TypeError)) {
          throw new ApiError("UniFi Site Manager request failed", { code: "request_failed" });
        }
        if (attempt === limits.maxAttempts) {
          throw new ApiError("UniFi Site Manager request timed out", { code: "timeout" });
        }
        await sleep(Math.min(limits.maxRetryWaitMs, 500 * 2 ** (attempt - 1)));
      }
    }
    throw new ApiError("UniFi Site Manager request failed", { code: "request_failed" });
  };

  const clampPageSize = (value) => {
    if (value == null) return limits.siteManagerDefaultPageSize;
    const size = Number(value);
    if (!Number.isInteger(size) || size < 1) {
      throw new ApiError("pageSize must be a positive integer", { code: "invalid_input" });
    }
    return Math.min(size, limits.siteManagerMaxPageSize);
  };

  const clampLimit = (value) => {
    if (value == null) return limits.networkDefaultLimit;
    const size = Number(value);
    if (!Number.isInteger(size) || size < 1) {
      throw new ApiError("limit must be a positive integer", { code: "invalid_input" });
    }
    return Math.min(size, limits.networkMaxLimit);
  };

  const listCollection = async (path, { query = {}, pageSize, maxPages } = {}) => {
    const size = clampPageSize(pageSize);
    const cap = maxPages ?? limits.siteManagerMaxPages;
    const items = [];
    const seen = new Set();
    let token;
    let pages = 0;
    while (pages < cap) {
      const nextQuery = { ...query, pageSize: String(size) };
      if (token) nextQuery.nextToken = token;
      const payload = await request("GET", path, { query: nextQuery });
      pages += 1;
      const data = Array.isArray(payload?.data) ? payload.data : [];
      items.push(...data);
      const next = typeof payload?.nextToken === "string" && payload.nextToken ? payload.nextToken : null;
      if (!next) return { items, pages, truncated: false, nextToken: null };
      if (!SAFE_ID.test(next) || next.includes("..")) {
        return { items, pages, truncated: true, nextToken: null, truncationReason: "unexpected_next_token" };
      }
      if (seen.has(next)) {
        return { items, pages, truncated: true, nextToken: next, truncationReason: "repeated_next_token" };
      }
      seen.add(next);
      token = next;
      if (pages >= cap) {
        return { items, pages, truncated: true, nextToken: next, truncationReason: "max_pages" };
      }
    }
    return { items, pages, truncated: true, nextToken: token ?? null, truncationReason: "max_pages" };
  };

  const connectorSuffix = (suffix) => {
    if (suffix === "network/integration/v1/sites") return suffix;
    const match = suffix.match(/^network\/integration\/v1\/sites\/([0-9a-f-]{36})\/vpn\/(servers|site-to-site-tunnels)$/i);
    if (!match || !UUID.test(match[1])) {
      throw new ApiError("connector path is not allowed", { code: "invalid_input" });
    }
    return suffix;
  };

  const listNetwork = async (hostId, suffix, { limit, maxPages } = {}) => {
    const safeHost = assertSafeId(hostId, "host id");
    const safeSuffix = connectorSuffix(suffix);
    const size = clampLimit(limit);
    const cap = maxPages ?? limits.networkMaxPages;
    const items = [];
    let offset = 0;
    let pages = 0;
    let totalCount = null;
    let truncated = false;
    while (pages < cap) {
      const payload = await request("GET", `/v1/connector/consoles/${encodeId(safeHost)}/${safeSuffix}`, {
        query: { offset: String(offset), limit: String(size) },
        consoleId: safeHost,
      });
      pages += 1;
      const data = Array.isArray(payload?.data) ? payload.data : [];
      items.push(...data);
      if (Number.isFinite(payload?.totalCount)) totalCount = payload.totalCount;
      if (data.length === 0) break;
      offset += data.length;
      if (totalCount != null && offset >= totalCount) break;
      if (data.length < size) break;
      if (pages >= cap) {
        truncated = totalCount == null || offset < totalCount;
        break;
      }
    }
    return { items, pages, truncated, totalCount, offset };
  };

  return { request, listCollection, listNetwork, limits };
}

export function createClientFromEnv(env = process.env, deps = {}) {
  return createClient({
    apiKey: requireApiKey(env),
    fetchImpl: deps.fetchImpl,
    now: deps.now,
    sleep: deps.sleep,
    limits: deps.limits,
  });
}

export function createApi(siteClient) {
  const listHosts = (options = {}) => siteClient.listCollection("/v1/hosts", options);

  const getHost = async (id) => {
    const payload = await siteClient.request("GET", `/v1/hosts/${encodeId(assertSafeId(id, "host id"))}`);
    return payload.data ?? null;
  };

  const listSites = (options = {}) => siteClient.listCollection("/v1/sites", options);

  const listDevices = (options = {}) => {
    const query = {};
    if (options.hostIds) {
      if (!Array.isArray(options.hostIds) || options.hostIds.length < 1 || options.hostIds.length > siteClient.limits.maxHostIds) {
        throw new ApiError("hostIds must be a bounded list", { code: "invalid_input" });
      }
      query["hostIds[]"] = options.hostIds.map((id) => assertSafeId(id, "host id"));
    }
    if (options.time) {
      if (!RFC3339.test(options.time)) throw new ApiError("time must be RFC3339 UTC", { code: "invalid_input" });
      query.time = options.time;
    }
    return siteClient.listCollection("/v1/devices", { ...options, query });
  };

  const listSiteHealth = async (options = {}) => {
    const page = await listSites(options);
    return {
      ...page,
      items: page.items.map((site) => ({
        siteId: site.siteId ?? null,
        hostId: site.hostId ?? null,
        permission: site.permission ?? null,
        isOwner: site.isOwner ?? null,
        name: site.meta?.desc || site.meta?.name || null,
        wanUptimePercent: site.statistics?.percentages?.wanUptime ?? null,
        counts: site.statistics?.counts ?? null,
        internetIssues: site.statistics?.internetIssues ?? [],
        ispInfo: site.statistics?.ispInfo ?? null,
      })),
    };
  };

  const discoverLocations = async () => {
    const errors = [];
    const hosts = await listHosts();
    let sites = { items: [], truncated: false };
    let devices = { items: [], truncated: false };
    try {
      sites = await listSites();
    } catch (err) {
      errors.push({ scope: "sites", ...errorInfo(err) });
    }
    try {
      devices = await listDevices();
    } catch (err) {
      errors.push({ scope: "devices", ...errorInfo(err) });
    }
    return {
      hosts: hosts.items,
      sites: sites.items,
      consoles: hosts.items.map((host) => ({
        hostId: host.id,
        owner: host.owner ?? null,
        type: host.type ?? null,
        firmware: firmwareStatus(firmwareVersionForHost(host.id, devices.items)),
      })),
      errors,
      truncated: Boolean(hosts.truncated || sites.truncated || devices.truncated),
    };
  };

  const getIspMetrics = async (input) => {
    validateIspRange(input);
    const query = {};
    if (input.duration) query.duration = input.duration;
    if (input.beginTimestamp) query.beginTimestamp = input.beginTimestamp;
    if (input.endTimestamp) query.endTimestamp = input.endTimestamp;
    const payload = await siteClient.request("GET", `/v1/isp-metrics/${input.type}`, { query });
    return payload.data ?? [];
  };

  const queryIspMetrics = async ({ type, sites }) => {
    assertIspType(type);
    if (!Array.isArray(sites) || sites.length < 1 || sites.length > siteClient.limits.maxQuerySites) {
      throw new ApiError("sites must be a bounded non-empty list", { code: "invalid_input" });
    }
    const clean = sites.map((site) => {
      assertSafeId(site?.hostId, "host id");
      assertSafeId(site?.siteId, "site id");
      const item = { hostId: site.hostId, siteId: site.siteId };
      if (site.beginTimestamp || site.endTimestamp) {
        if (!RFC3339.test(site.beginTimestamp || "") || !RFC3339.test(site.endTimestamp || "")) {
          throw new ApiError("query timestamps must be RFC3339 UTC and paired", { code: "invalid_input" });
        }
        item.beginTimestamp = site.beginTimestamp;
        item.endTimestamp = site.endTimestamp;
      }
      return item;
    });
    const payload = await siteClient.request("POST", `/v1/isp-metrics/${type}/query`, { body: { sites: clean } });
    return payload.data ?? null;
  };

  const listSdWanConfigs = async () => {
    const payload = await siteClient.request("GET", "/v1/sd-wan-configs");
    return Array.isArray(payload.data) ? payload.data : [];
  };

  const getSdWanConfig = async (id) => {
    const payload = await siteClient.request("GET", `/v1/sd-wan-configs/${encodeId(assertSafeId(id, "SD-WAN id"))}`);
    return payload.data ?? null;
  };

  const getSdWanStatus = async (id) => {
    const payload = await siteClient.request("GET", `/v1/sd-wan-configs/${encodeId(assertSafeId(id, "SD-WAN id"))}/status`);
    return payload.data ?? null;
  };

  const listVpnStatus = async ({ hostId, limit } = {}) => {
    const hostPage = await listHosts();
    const devicePage = await listDevices();
    let hosts = hostPage.items;
    if (hostId) {
      assertSafeId(hostId, "host id");
      hosts = hosts.filter((host) => host.id === hostId);
    }
    const results = [];
    for (const host of hosts) {
      const version = firmwareVersionForHost(host.id, devicePage.items);
      const gate = firmwareStatus(version);
      if (gate.state !== "ok") {
        results.push({
          hostId: host.id,
          ok: false,
          error: {
            code: gate.state === "unsupported" ? "firmware_unsupported" : "firmware_unknown",
            status: null,
            message: gate.state === "unsupported"
              ? `Console firmware ${gate.version} is below ${gate.minimum}`
              : "Console firmware is not available. Cloud Connector requires firmware >= 5.0.3, so this console was not called.",
            firmware: gate,
          },
        });
        continue;
      }
      try {
        const networkSites = await siteClient.listNetwork(host.id, "network/integration/v1/sites", { limit });
        const siteResults = [];
        for (const site of networkSites.items) {
          if (typeof site?.id !== "string" || !UUID.test(site.id)) {
            siteResults.push({
              siteId: null,
              ok: false,
              error: {
                code: "invalid_site_id",
                status: null,
                message: "Network site id is not a UUID and was not placed in a request path",
              },
            });
            continue;
          }
          try {
            const servers = await siteClient.listNetwork(host.id, `network/integration/v1/sites/${site.id}/vpn/servers`, { limit });
            const tunnels = await siteClient.listNetwork(
              host.id,
              `network/integration/v1/sites/${site.id}/vpn/site-to-site-tunnels`,
              { limit },
            );
            siteResults.push({
              siteId: site.id,
              name: site.name ?? null,
              ok: true,
              servers: servers.items,
              tunnels: tunnels.items,
              truncated: Boolean(servers.truncated || tunnels.truncated),
            });
          } catch (err) {
            siteResults.push({ siteId: site.id, ok: false, error: errorInfo(err) });
          }
        }
        results.push({
          hostId: host.id,
          ok: true,
          owner: host.owner ?? null,
          firmware: gate,
          sites: siteResults,
          partial: siteResults.some((site) => !site.ok),
        });
      } catch (err) {
        results.push({ hostId: host.id, ok: false, owner: host.owner ?? null, firmware: gate, error: errorInfo(err) });
      }
    }
    return {
      hosts: results,
      truncated: Boolean(hostPage.truncated || devicePage.truncated),
    };
  };

  return {
    listHosts,
    getHost,
    listSites,
    listSiteHealth,
    listDevices,
    discoverLocations,
    getIspMetrics,
    queryIspMetrics,
    listSdWanConfigs,
    getSdWanConfig,
    getSdWanStatus,
    listVpnStatus,
    apiLimitations: async () => API_LIMITATIONS,
  };
}

const pageArgs = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageSize: { type: "integer", minimum: 1, maximum: LIMITS.siteManagerMaxPageSize },
    maxPages: { type: "integer", minimum: 1, maximum: LIMITS.siteManagerMaxPages },
  },
};

export const TOOLS = [
  {
    name: "unifi_sm_list_hosts",
    description: "Read every Site Manager host visible to the API key (GET /v1/hosts), following nextToken up to the bounded page cap. Read-only.",
    inputSchema: pageArgs,
  },
  {
    name: "unifi_sm_get_host",
    description: "Read one Site Manager host by id (GET /v1/hosts/{id}). Read-only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "string" } },
    },
  },
  {
    name: "unifi_sm_list_sites",
    description: "Read Site Manager sites for all locations (GET /v1/sites), including permission, ownership, and statistics. Read-only.",
    inputSchema: pageArgs,
  },
  {
    name: "unifi_sm_list_site_health",
    description: "Read cloud site health from documented site statistics: WAN uptime, device counts, ISP info, and internet issues. Read-only.",
    inputSchema: pageArgs,
  },
  {
    name: "unifi_sm_list_devices",
    description: "Read devices for hosts where the account is owner or super admin (GET /v1/devices). Includes console firmware version when isConsole is true. Read-only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...pageArgs.properties,
        hostIds: { type: "array", items: { type: "string" }, maxItems: LIMITS.maxHostIds },
        time: { type: "string", description: "RFC3339 timestamp" },
      },
    },
  },
  {
    name: "unifi_sm_discover_locations",
    description: "Read hosts, sites, and per-console firmware gate results for every location. A failed site or device read is reported without dropping hosts already read. Read-only.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "unifi_sm_get_isp_metrics",
    description: "Read WAN/ISP metrics for all accessible sites (GET /v1/isp-metrics/{type}). type is 5m (duration 24h) or 1h (duration 7d or 30d). Read-only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["type"],
      properties: {
        type: { type: "string", enum: ["5m", "1h"] },
        duration: { type: "string", enum: ["24h", "7d", "30d"] },
        beginTimestamp: { type: "string" },
        endTimestamp: { type: "string" },
      },
    },
  },
  {
    name: "unifi_sm_query_isp_metrics",
    description: "Read WAN/ISP metrics for specific sites. POST /v1/isp-metrics/{type}/query is the documented read query and does not change configuration. Partial access returns status partialSuccess.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["type", "sites"],
      properties: {
        type: { type: "string", enum: ["5m", "1h"] },
        sites: {
          type: "array",
          maxItems: LIMITS.maxQuerySites,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["hostId", "siteId"],
            properties: {
              hostId: { type: "string" },
              siteId: { type: "string" },
              beginTimestamp: { type: "string" },
              endTimestamp: { type: "string" },
            },
          },
        },
      },
    },
  },
  {
    name: "unifi_sm_list_sdwan_configs",
    description: "Read SD-WAN configurations (GET /v1/sd-wan-configs). Read-only.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "unifi_sm_get_sdwan_config",
    description: "Read one SD-WAN configuration (GET /v1/sd-wan-configs/{id}). Read-only. Does not change hubs or spokes.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "string" } },
    },
  },
  {
    name: "unifi_sm_get_sdwan_status",
    description: "Read SD-WAN deployment and WAN status (GET /v1/sd-wan-configs/{id}/status). Read-only.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["id"],
      properties: { id: { type: "string" } },
    },
  },
  {
    name: "unifi_sm_list_vpn_status",
    description: "Read Network VPN servers and site-to-site tunnels through Cloud Connector GET routes only. Consoles below firmware 5.0.3, or with unknown firmware, are reported and not called. A permission or firmware error on one console does not drop the others. Does not create or modify VPN peers.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        hostId: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: LIMITS.networkMaxLimit },
      },
    },
  },
  {
    name: "unifi_sm_api_limitations",
    description: "Return the verified Site Manager and Network API limits for this read-only plugin, including GET only VPN routes. No network call.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
];

export async function callTool(api, name, args = {}) {
  const known = TOOLS.some((tool) => tool.name === name);
  if (!known) throw new ApiError(`Unknown tool: ${name}`, { code: "unknown_tool" });
  let result;
  switch (name) {
    case "unifi_sm_list_hosts":
      result = await api.listHosts(args);
      break;
    case "unifi_sm_get_host":
      result = await api.getHost(args.id);
      break;
    case "unifi_sm_list_sites":
      result = await api.listSites(args);
      break;
    case "unifi_sm_list_site_health":
      result = await api.listSiteHealth(args);
      break;
    case "unifi_sm_list_devices":
      result = await api.listDevices(args);
      break;
    case "unifi_sm_discover_locations":
      result = await api.discoverLocations();
      break;
    case "unifi_sm_get_isp_metrics":
      result = await api.getIspMetrics(args);
      break;
    case "unifi_sm_query_isp_metrics":
      result = await api.queryIspMetrics(args);
      break;
    case "unifi_sm_list_sdwan_configs":
      result = await api.listSdWanConfigs();
      break;
    case "unifi_sm_get_sdwan_config":
      result = await api.getSdWanConfig(args.id);
      break;
    case "unifi_sm_get_sdwan_status":
      result = await api.getSdWanStatus(args.id);
      break;
    case "unifi_sm_list_vpn_status":
      result = await api.listVpnStatus(args);
      break;
    case "unifi_sm_api_limitations":
      result = await api.apiLimitations();
      break;
    default:
      throw new ApiError(`Unknown tool: ${name}`, { code: "unknown_tool" });
  }
  return JSON.stringify(result, null, 2);
}
