# Obsidian Sync Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an MCP server plugin that automatically syncs git project state to Obsidian vault notes with session logging.

**Architecture:** Node.js MCP server in `ai-claude-plugins/obsidian-sync/` with 6 tools. Server is split into focused modules: `exec.js` (shell helper), `git.js` (git data), `github.js` (gh CLI), `discovery.js` (project scanning), `notes.js` (Markdown generation/parsing), `index.js` (MCP server). Skills guide session-start/end workflows.

**Tech Stack:** Node.js (ES modules), `@modelcontextprotocol/sdk`, `node:child_process`, `node:fs/promises`, `node:test`

---

## File Structure

```
obsidian-sync/
├── .claude-plugin/
│   └── plugin.json           # Plugin manifest with env var declarations
├── .mcp.json                 # MCP server config pointing to server/index.js
├── README.md                 # Plugin documentation
├── server/
│   ├── package.json          # Dependencies: @modelcontextprotocol/sdk
│   ├── index.js              # MCP server setup, tool definitions, handler routing
│   ├── exec.js               # Shell command execution helper
│   ├── git.js                # Git CLI wrappers (branch, status, log, remote)
│   ├── github.js             # GitHub CLI wrappers (PRs, issues)
│   ├── discovery.js          # Project scanning, tech stack, architecture, TODOs, deployment
│   ├── notes.js              # Note generation, parsing, section management, read/write
│   └── test/
│       └── notes.test.js     # Unit tests for pure formatting/parsing functions
└── skills/
    ├── configure/SKILL.md    # First-time setup guide
    ├── session-start/SKILL.md # Start-of-conversation sync + context load
    └── session-end/SKILL.md  # End-of-conversation session log + final sync
```

**Modify:** `.claude-plugin/marketplace.json` — add obsidian-sync entry to plugins array

---

### Task 1: Plugin Scaffolding

**Files:**
- Create: `obsidian-sync/.claude-plugin/plugin.json`
- Create: `obsidian-sync/.mcp.json`
- Create: `obsidian-sync/server/package.json`

- [ ] **Step 1: Create plugin.json**

```json
{
  "name": "obsidian-sync",
  "version": "0.1.0",
  "description": "Automatic Obsidian vault sync for git projects — tracks git status, commits, PRs, issues, TODOs, architecture, and session logs as living Markdown notes",
  "author": {
    "name": "Paul Zharyuk"
  },
  "keywords": [
    "obsidian",
    "sync",
    "git",
    "second-brain",
    "knowledge-management"
  ],
  "setup": {
    "env": {
      "OBSIDIAN_VAULT_PATH": {
        "description": "Absolute path to your Obsidian vault (e.g. ~/Documents/Obsidian/SecondBrain)",
        "required": true
      },
      "PROJECTS_DIR": {
        "description": "Absolute path to the directory containing your git repositories (e.g. ~/Documents/Claude/Projects)",
        "required": true
      },
      "OBSIDIAN_PROJECTS_FOLDER": {
        "description": "Folder name within the vault where project notes are stored (default: Projects)",
        "required": false,
        "default": "Projects"
      }
    }
  }
}
```

Write to `obsidian-sync/.claude-plugin/plugin.json`.

- [ ] **Step 2: Create .mcp.json**

```json
{
  "mcpServers": {
    "obsidian-sync": {
      "command": "node",
      "args": ["${CLAUDE_PLUGIN_ROOT}/server/index.js"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "${OBSIDIAN_VAULT_PATH}",
        "PROJECTS_DIR": "${PROJECTS_DIR}",
        "OBSIDIAN_PROJECTS_FOLDER": "${OBSIDIAN_PROJECTS_FOLDER}"
      }
    }
  }
}
```

Write to `obsidian-sync/.mcp.json`.

- [ ] **Step 3: Create package.json**

```json
{
  "name": "obsidian-sync-server",
  "version": "1.0.0",
  "description": "MCP server for Obsidian vault project sync",
  "main": "index.js",
  "scripts": {
    "test": "node --test test/*.test.js"
  },
  "keywords": [],
  "author": "Paul Zharyuk",
  "license": "ISC",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1"
  },
  "type": "module"
}
```

Write to `obsidian-sync/server/package.json`.

- [ ] **Step 4: Install dependencies**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && npm install`
Expected: `added X packages` with `node_modules/` created

- [ ] **Step 5: Commit scaffolding**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add obsidian-sync/.claude-plugin/plugin.json obsidian-sync/.mcp.json obsidian-sync/server/package.json obsidian-sync/server/package-lock.json
git commit -m "feat(obsidian-sync): add plugin scaffolding"
```

---

### Task 2: Shell Execution Helper

**Files:**
- Create: `obsidian-sync/server/exec.js`

- [ ] **Step 1: Write exec.js**

```javascript
import { execFile } from "node:child_process";

/**
 * Execute a shell command and return stdout/stderr/exitCode without throwing.
 */
export function exec(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    execFile(
      cmd,
      args,
      { maxBuffer: 10 * 1024 * 1024, ...opts },
      (error, stdout, stderr) => {
        resolve({
          stdout: (stdout ?? "").trim(),
          stderr: (stderr ?? "").trim(),
          exitCode: error ? error.code ?? 1 : 0,
        });
      }
    );
  });
}
```

Write to `obsidian-sync/server/exec.js`.

- [ ] **Step 2: Verify it loads**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && node -e "import('./exec.js').then(m => m.exec('echo', ['hello']).then(r => console.log(r)))"`
Expected: `{ stdout: 'hello', stderr: '', exitCode: 0 }`

- [ ] **Step 3: Commit**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add obsidian-sync/server/exec.js
git commit -m "feat(obsidian-sync): add shell execution helper"
```

---

### Task 3: Git Data Gathering

**Files:**
- Create: `obsidian-sync/server/git.js`

- [ ] **Step 1: Write git.js**

```javascript
import { exec } from "./exec.js";

const SEP = "\x1f"; // unit separator — safe delimiter for git format strings

export async function getGitBranch(projectPath) {
  const { stdout } = await exec("git", ["-C", projectPath, "branch", "--show-current"]);
  return stdout || "HEAD (detached)";
}

export async function getLastCommit(projectPath) {
  const { stdout } = await exec("git", [
    "-C", projectPath, "log", "-1", `--format=%h${SEP}%s${SEP}%ai`,
  ]);
  if (!stdout) return null;
  const [hash, message, dateStr] = stdout.split(SEP);
  return { hash, message, date: dateStr?.split(" ")[0] };
}

export async function getUncommittedChanges(projectPath) {
  const { stdout } = await exec("git", ["-C", projectPath, "status", "--porcelain"]);
  if (!stdout) return [];
  return stdout.split("\n").filter(Boolean);
}

export async function getRecentCommits(projectPath, count = 20) {
  const { stdout } = await exec("git", [
    "-C", projectPath, "log", `-${count}`, `--format=%h${SEP}%s${SEP}%ai`,
  ]);
  if (!stdout) return [];
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, message, dateStr] = line.split(SEP);
      return { hash, message, date: dateStr?.split(" ")[0] };
    });
}

export async function getRemoteUrl(projectPath) {
  const { stdout } = await exec("git", ["-C", projectPath, "remote", "get-url", "origin"]);
  return stdout || null;
}

export function parseOwnerRepo(remoteUrl) {
  if (!remoteUrl) return null;
  const match = remoteUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  return match ? `${match[1]}/${match[2]}` : null;
}
```

Write to `obsidian-sync/server/git.js`.

- [ ] **Step 2: Verify against a real repo**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && node -e "import('./git.js').then(async m => { const p = '/Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins'; console.log('branch:', await m.getGitBranch(p)); console.log('last:', await m.getLastCommit(p)); console.log('remote:', await m.getRemoteUrl(p)); console.log('owner:', m.parseOwnerRepo(await m.getRemoteUrl(p))); })"`
Expected: branch name, last commit object, remote URL, and owner/repo string

- [ ] **Step 3: Commit**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add obsidian-sync/server/git.js
git commit -m "feat(obsidian-sync): add git data gathering module"
```

---

### Task 4: GitHub Data Gathering

**Files:**
- Create: `obsidian-sync/server/github.js`

- [ ] **Step 1: Write github.js**

```javascript
import { exec } from "./exec.js";

let ghCliAvailable = null;

export async function hasGhCli() {
  if (ghCliAvailable !== null) return ghCliAvailable;
  const { exitCode } = await exec("gh", ["auth", "status"]);
  ghCliAvailable = exitCode === 0;
  return ghCliAvailable;
}

export async function getOpenPRs(ownerRepo, limit = 20) {
  if (!(await hasGhCli())) return null;
  const { stdout, exitCode } = await exec("gh", [
    "pr", "list",
    "--repo", ownerRepo,
    "--state", "open",
    "--limit", String(limit),
    "--json", "number,title,isDraft,changedFiles,reviewDecision",
  ]);
  if (exitCode !== 0 || !stdout) return [];
  try {
    return JSON.parse(stdout);
  } catch {
    return [];
  }
}

export async function getOpenIssues(ownerRepo, limit = 20) {
  if (!(await hasGhCli())) return null;
  const { stdout, exitCode } = await exec("gh", [
    "issue", "list",
    "--repo", ownerRepo,
    "--state", "open",
    "--limit", String(limit),
    "--json", "number,title,labels",
  ]);
  if (exitCode !== 0 || !stdout) return [];
  try {
    return JSON.parse(stdout);
  } catch {
    return [];
  }
}
```

Write to `obsidian-sync/server/github.js`.

- [ ] **Step 2: Verify gh CLI works**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && node -e "import('./github.js').then(async m => { console.log('gh available:', await m.hasGhCli()); console.log('PRs:', await m.getOpenPRs('Pzharyuk/ai-business-tools')); })"`
Expected: `gh available: true` and an array of PR objects (or empty array)

- [ ] **Step 3: Commit**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add obsidian-sync/server/github.js
git commit -m "feat(obsidian-sync): add GitHub CLI data gathering module"
```

---

### Task 5: Project Discovery and Architecture Detection

**Files:**
- Create: `obsidian-sync/server/discovery.js`

- [ ] **Step 1: Write discovery.js**

```javascript
import { readdir, readFile, access } from "node:fs/promises";
import { join, relative } from "node:path";
import { exec } from "./exec.js";
import { getGitBranch, getRemoteUrl } from "./git.js";
import { hasGhCli } from "./github.js";

export async function discoverProjects(projectsDir) {
  const entries = await readdir(projectsDir, { withFileTypes: true });
  const projects = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = join(projectsDir, entry.name);
    try {
      await access(join(fullPath, ".git"));
    } catch {
      continue;
    }

    const branch = await getGitBranch(fullPath);
    const remote = await getRemoteUrl(fullPath);
    const ghCli = await hasGhCli();

    projects.push({
      name: entry.name,
      path: fullPath,
      remote: remote || null,
      branch,
      hasGhCli: ghCli && !!remote,
    });
  }

  return projects;
}

export async function detectTechStack(projectPath) {
  const lines = [];

  // --- Node.js / package.json ---
  try {
    const pkg = JSON.parse(await readFile(join(projectPath, "package.json"), "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps.typescript || deps["ts-node"]) lines.push("- **Runtime:** Node.js, TypeScript");
    else lines.push("- **Runtime:** Node.js");

    const frameworks = [];
    if (deps.next) frameworks.push("Next.js");
    if (deps.react) frameworks.push("React");
    if (deps.express) frameworks.push("Express");
    if (deps.fastify) frameworks.push("Fastify");
    if (deps["socket.io"]) frameworks.push("Socket.io");
    if (deps.vite) frameworks.push("Vite");
    if (frameworks.length) lines.push(`- **Framework:** ${frameworks.join(", ")}`);

    const db = [];
    if (deps.pg || deps.postgres) db.push("PostgreSQL");
    if (deps["drizzle-orm"]) db.push("Drizzle ORM");
    if (deps["@prisma/client"] || deps.prisma) db.push("Prisma");
    if (deps.mongoose) db.push("MongoDB");
    if (deps.sqlite3 || deps["better-sqlite3"] || deps.aiosqlite) db.push("SQLite");
    if (deps.redis || deps.ioredis) db.push("Redis");
    if (db.length) lines.push(`- **Database:** ${db.join(", ")}`);

    const integrations = [];
    if (deps["@anthropic-ai/sdk"]) integrations.push("Anthropic SDK");
    if (deps.openai) integrations.push("OpenAI SDK");
    if (deps.stripe) integrations.push("Stripe");
    if (deps.plaid) integrations.push("Plaid");
    if (deps.playwright) integrations.push("Playwright");
    if (integrations.length) lines.push(`- **Integrations:** ${integrations.join(", ")}`);
  } catch {
    /* no package.json */
  }

  // --- Python / pyproject.toml ---
  try {
    const content = await readFile(join(projectPath, "pyproject.toml"), "utf-8");
    if (!lines.some((l) => l.includes("Runtime"))) lines.push("- **Runtime:** Python");

    const frameworks = [];
    if (content.includes("fastapi")) frameworks.push("FastAPI");
    if (content.includes("django")) frameworks.push("Django");
    if (content.includes("flask")) frameworks.push("Flask");
    if (frameworks.length) lines.push(`- **Framework:** ${frameworks.join(", ")}`);

    const db = [];
    if (content.includes("sqlalchemy")) db.push("SQLAlchemy");
    if (content.includes("aiosqlite")) db.push("SQLite");
    if (db.length) lines.push(`- **Database:** ${db.join(", ")}`);

    const integrations = [];
    if (content.includes("playwright")) integrations.push("Playwright");
    if (content.includes("ollama")) integrations.push("Ollama");
    if (content.includes("telegram")) integrations.push("Telegram Bot");
    if (integrations.length) lines.push(`- **Integrations:** ${integrations.join(", ")}`);
  } catch {
    /* no pyproject.toml */
  }

  // --- Python / Pipfile ---
  try {
    const content = await readFile(join(projectPath, "Pipfile"), "utf-8");
    if (!lines.some((l) => l.includes("Runtime"))) {
      lines.push("- **Runtime:** Python");
      if (content.includes("sqlalchemy")) lines.push("- **Database:** SQLAlchemy");
      if (content.includes("playwright")) lines.push("- **Integrations:** Playwright");
    }
  } catch {
    /* no Pipfile */
  }

  // --- Docker ---
  try {
    await access(join(projectPath, "docker-compose.yml"));
    lines.push("- **Containers:** Docker Compose");
  } catch {
    try {
      await access(join(projectPath, "Dockerfile"));
      lines.push("- **Containers:** Docker");
    } catch {
      /* no docker */
    }
  }

  return lines.join("\n") || "Not detected";
}

export async function detectArchitecture(projectPath) {
  const entries = await readdir(projectPath, { withFileTypes: true });
  const skipDirs = new Set([
    "node_modules", "__pycache__", ".venv", "dist", "build",
    ".next", "vendor", "coverage", ".git",
  ]);
  const dirs = entries
    .filter((e) => e.isDirectory() && !e.name.startsWith(".") && !skipDirs.has(e.name))
    .map((e) => e.name);

  const lines = [];

  // Monorepo check
  if (dirs.includes("backend") && dirs.includes("frontend")) {
    lines.push("- **Structure:** Monorepo (`backend/` + `frontend/`)");
  }

  // src/ deep scan
  if (dirs.includes("src")) {
    try {
      const srcEntries = await readdir(join(projectPath, "src"), { withFileTypes: true });
      const srcDirs = srcEntries.filter((e) => e.isDirectory()).map((e) => e.name);

      if (srcDirs.includes("app")) lines.push("- Entry: `src/app/`");
      if (srcDirs.includes("pages")) lines.push("- Pages: `src/pages/`");
      if (srcDirs.includes("components")) lines.push("- Components: `src/components/`");
      if (srcDirs.includes("plugins")) lines.push("- Plugins: `src/plugins/`");
      if (srcDirs.includes("services")) lines.push("- Services: `src/services/`");
      if (srcDirs.includes("db")) lines.push("- Database: `src/db/`");
      if (srcDirs.includes("lib")) lines.push("- Lib: `src/lib/`");
      if (srcDirs.includes("api")) lines.push("- API: `src/api/`");
    } catch {
      /* can't read src */
    }
  }

  // GitOps patterns
  if (dirs.includes("charts")) lines.push("- Helm Charts: `charts/`");
  if (dirs.includes("apps")) lines.push("- ArgoCD Apps: `apps/`");

  // Other notable dirs
  if (dirs.includes("config")) lines.push("- Config: `config/`");
  if (dirs.includes("tests")) lines.push("- Tests: `tests/`");
  if (dirs.includes("pipeline")) lines.push("- Pipeline: `pipeline/`");

  // Fallback — list top dirs
  if (!lines.length) {
    lines.push(`- Directories: ${dirs.slice(0, 10).map((d) => "\`" + d + "/\`").join(", ")}`);
  }

  return lines.join("\n") || "Not detected";
}

export async function generateOverview(projectPath) {
  // Try README first
  try {
    const readme = await readFile(join(projectPath, "README.md"), "utf-8");
    const lines = readme.split("\n");
    let paragraph = "";
    let inParagraph = false;
    for (const line of lines) {
      if (line.startsWith("#") || line.startsWith("![") || line.startsWith("<!--") || line.startsWith("```")) continue;
      if (line.trim() === "") {
        if (inParagraph) break;
        continue;
      }
      inParagraph = true;
      paragraph += (paragraph ? " " : "") + line.trim();
    }
    if (paragraph) return paragraph;
  } catch {
    /* no README */
  }

  // Fallback to package.json description
  try {
    const pkg = JSON.parse(await readFile(join(projectPath, "package.json"), "utf-8"));
    if (pkg.description) return pkg.description;
  } catch {
    /* no package.json */
  }

  return "No description available.";
}

export async function extractTodos(projectPath, limit = 30) {
  const excludeDirs = [
    "node_modules", ".git", "dist", "build", "__pycache__",
    ".venv", ".next", "vendor", "coverage",
  ];
  const excludeArgs = excludeDirs.flatMap((d) => ["--exclude-dir", d]);

  const { stdout } = await exec("grep", [
    "-rn",
    "--include=*.js", "--include=*.ts", "--include=*.tsx", "--include=*.jsx",
    "--include=*.py", "--include=*.go", "--include=*.rs", "--include=*.java",
    ...excludeArgs,
    "-E", "\\b(TODO|FIXME|HACK)\\b",
    projectPath,
  ]);

  if (!stdout) return [];

  return stdout
    .split("\n")
    .filter(Boolean)
    .slice(0, limit)
    .map((line) => {
      const match = line.match(/^(.+?):(\d+):(.+)$/);
      if (!match) return null;
      const [, filePath, lineNum, content] = match;
      return { file: relative(projectPath, filePath), line: lineNum, content: content.trim() };
    })
    .filter(Boolean);
}

export async function detectDeployment(projectsDir, projectDirName) {
  const gitopsPath = join(projectsDir, "hgwa-k8s-gitops");
  try {
    await access(gitopsPath);
  } catch {
    return null;
  }

  const lines = [];

  // Check charts/
  try {
    const charts = await readdir(join(gitopsPath, "charts"), { withFileTypes: true });
    const chartMatch = charts.find(
      (e) =>
        e.isDirectory() &&
        (e.name === projectDirName ||
          projectDirName.includes(e.name) ||
          e.name.includes(projectDirName))
    );
    if (chartMatch) {
      lines.push(`- **GitOps:** [[HGwa K8S Gitops]]/charts/${chartMatch.name}`);
      try {
        const values = await readFile(
          join(gitopsPath, "charts", chartMatch.name, "values.yaml"),
          "utf-8"
        );
        const domainMatch = values.match(/host:\s*["']?([a-z0-9.-]+\.[a-z]+)["']?/i);
        if (domainMatch) lines.push(`- **Domain:** ${domainMatch[1]}`);
      } catch {
        /* no values.yaml */
      }
    }
  } catch {
    /* no charts dir */
  }

  // Check apps/
  try {
    const apps = await readdir(join(gitopsPath, "apps"), { withFileTypes: true });
    const appMatch = apps.find((e) => {
      const name = e.name.replace(/\.yaml$/, "");
      return name === projectDirName || projectDirName.includes(name) || name.includes(projectDirName);
    });
    if (appMatch) lines.push(`- **ArgoCD App:** [[HGwa K8S Gitops]]/apps/${appMatch.name}`);
  } catch {
    /* no apps dir */
  }

  return lines.length ? lines.join("\n") : null;
}
```

Write to `obsidian-sync/server/discovery.js`.

- [ ] **Step 2: Verify project discovery**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && node -e "import('./discovery.js').then(async m => { const projects = await m.discoverProjects('/Users/pzharyuk/Documents/Claude/Projects'); console.log(JSON.stringify(projects, null, 2)); })"`
Expected: Array with 5 projects (ai-business-tools, ai-claude-plugins, car-deal-finder, hgwa-k8s-gitops, live-translator-node)

- [ ] **Step 3: Verify tech stack detection**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && node -e "import('./discovery.js').then(async m => { console.log(await m.detectTechStack('/Users/pzharyuk/Documents/Claude/Projects/ai-business-tools')); })"`
Expected: Formatted markdown list showing Node.js, TypeScript, Next.js, React, PostgreSQL, Drizzle, etc.

- [ ] **Step 4: Commit**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add obsidian-sync/server/discovery.js
git commit -m "feat(obsidian-sync): add project discovery and architecture detection"
```

---

### Task 6: Note Utilities — Pure Functions

**Files:**
- Create: `obsidian-sync/server/notes.js`

- [ ] **Step 1: Write notes.js**

```javascript
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";

// ─── Constants ───────────────────────────────────────────────────────────────

const ABBREVIATIONS = new Set([
  "AI", "API", "UI", "DB", "K8S", "MCP", "AWS", "GCP", "CI", "CD",
  "PR", "URL", "SSH", "SSL", "TLS", "HTTP", "HTTPS", "DNS", "VM",
  "NAS", "HA", "OS", "ID", "CLI", "SDK", "ORM", "CSS", "HTML",
  "PDF", "JWT", "SSO", "RBAC", "CRUD", "REST", "RPC",
]);

// ─── Name Derivation ─────────────────────────────────────────────────────────

export function projectNameFromDir(dirName) {
  return dirName
    .split("-")
    .map((word) => {
      const upper = word.toUpperCase();
      if (ABBREVIATIONS.has(upper)) return upper;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

// ─── File Paths ──────────────────────────────────────────────────────────────

export function notePath(vaultPath, projectsFolder, projectName) {
  return join(vaultPath, projectsFolder, `${projectName}.md`);
}

// ─── Frontmatter ─────────────────────────────────────────────────────────────

export function generateFrontmatter({ date, repo }) {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "");
  const lines = [
    "---",
    `date: ${date || now.split("T")[0]}`,
    `updated: ${now}`,
    "tags:",
    "  - project",
    "  - auto-sync",
    "status: active",
  ];
  if (repo) lines.push(`repo: ${repo}`);
  lines.push("---");
  return lines.join("\n");
}

export function updateFrontmatterTimestamp(frontmatter) {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, "");
  return frontmatter.replace(/^updated: .+$/m, `updated: ${now}`);
}

// ─── Section Formatters ──────────────────────────────────────────────────────

export function formatGitStatus({ branch, lastCommit, uncommittedChanges }) {
  const lines = [`- **Branch:** ${branch}`];
  if (lastCommit) {
    lines.push(
      `- **Last commit:** ${lastCommit.hash} — "${lastCommit.message}" (${lastCommit.date})`
    );
  } else {
    lines.push("- **Last commit:** none");
  }
  const changeCount = uncommittedChanges.length;
  lines.push(`- **Uncommitted changes:** ${changeCount ? changeCount + " files" : "none"}`);
  if (changeCount) {
    uncommittedChanges.slice(0, 10).forEach((c) => lines.push(`  - \`${c}\``));
    if (changeCount > 10) lines.push(`  - ...and ${changeCount - 10} more`);
  }
  return lines.join("\n");
}

export function formatRecentCommits(commits) {
  if (!commits.length) return "No commits found.";
  const lines = ["| Date | Hash | Message |", "|------|------|---------|"];
  commits.forEach((c) => lines.push(`| ${c.date} | ${c.hash} | ${c.message} |`));
  return lines.join("\n");
}

export function formatOpenPRs(prs, hasRemote) {
  if (!hasRemote) return "No remote configured.";
  if (prs === null) return "GitHub CLI not available — run `gh auth login` to enable.";
  if (!prs.length) return "None.";
  return prs
    .map((pr) => {
      const parts = [`**#${pr.number}**`, `— ${pr.title}`];
      if (pr.isDraft) parts.push("(draft)");
      if (pr.reviewDecision)
        parts.push(`(${pr.reviewDecision.toLowerCase().replace(/_/g, " ")})`);
      if (pr.changedFiles) parts.push(`(${pr.changedFiles} files)`);
      return `- ${parts.join(" ")}`;
    })
    .join("\n");
}

export function formatOpenIssues(issues, hasRemote) {
  if (!hasRemote) return "No remote configured.";
  if (issues === null) return "GitHub CLI not available — run `gh auth login` to enable.";
  if (!issues.length) return "None.";
  return issues
    .map((issue) => {
      const labels = issue.labels?.map((l) => l.name).join(", ");
      return `- **#${issue.number}** — ${issue.title}${labels ? ` (${labels})` : ""}`;
    })
    .join("\n");
}

export function formatTodos(todos) {
  if (!todos.length) return "None found.";
  return todos.map((t) => `- \`${t.file}:${t.line}\` — ${t.content}`).join("\n");
}

// ─── Note Generation ─────────────────────────────────────────────────────────

export function generateFullNote({
  projectName, frontmatter, overview, techStack, architecture,
  gitStatus, recentCommits, openPRs, openIssues, todos,
  deployment, hasRemote,
}) {
  const sections = [
    frontmatter,
    "",
    `# ${projectName}`,
    "",
    "## Overview",
    overview,
    "",
    "## Tech Stack",
    techStack,
    "",
    "## Architecture",
    architecture,
    "",
    "## Git Status",
    formatGitStatus(gitStatus),
    "",
    "## Recent Commits",
    formatRecentCommits(recentCommits),
    "",
    "## Open PRs",
    formatOpenPRs(openPRs, hasRemote),
    "",
    "## Active Issues",
    formatOpenIssues(openIssues, hasRemote),
    "",
    "## TODOs in Code",
    formatTodos(todos),
  ];

  if (deployment) {
    sections.push("", "## Deployment", deployment);
  }

  sections.push("", "## Session Log", "", "*No sessions recorded yet.*", "");

  return sections.join("\n");
}

// ─── Note Parsing ────────────────────────────────────────────────────────────

export function parseNoteSections(content) {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  const frontmatter = fmMatch ? `---\n${fmMatch[1]}\n---` : "";
  const body = fmMatch ? content.slice(fmMatch[0].length).trimStart() : content;

  const titleMatch = body.match(/^# (.+)/m);
  const title = titleMatch ? titleMatch[1] : "";

  const sections = new Map();
  const regex = /^## (.+)$/gm;
  let match;
  const headers = [];

  while ((match = regex.exec(body)) !== null) {
    headers.push({ name: match[1], index: match.index, end: match.index + match[0].length });
  }

  for (let i = 0; i < headers.length; i++) {
    const start = headers[i].end;
    const end = i + 1 < headers.length ? headers[i + 1].index : body.length;
    sections.set(headers[i].name, body.slice(start, end).trim());
  }

  return { frontmatter, title, sections };
}

// ─── Note Updating ───────────────────────────────────────────────────────────

export function updateNote(existingContent, newData) {
  const parsed = parseNoteSections(existingContent);

  // Overwrite live sections
  parsed.sections.set("Git Status", formatGitStatus(newData.gitStatus));
  parsed.sections.set("Recent Commits", formatRecentCommits(newData.recentCommits));
  parsed.sections.set("Open PRs", formatOpenPRs(newData.openPRs, newData.hasRemote));
  parsed.sections.set("Active Issues", formatOpenIssues(newData.openIssues, newData.hasRemote));
  parsed.sections.set("TODOs in Code", formatTodos(newData.todos));

  // Reconstruct with updated timestamp
  let output = updateFrontmatterTimestamp(parsed.frontmatter) + "\n\n";
  output += `# ${parsed.title}\n\n`;
  for (const [name, sectionContent] of parsed.sections) {
    output += `## ${name}\n${sectionContent}\n\n`;
  }

  return output.trimEnd() + "\n";
}

export function prependSessionLog(content, summary) {
  const date = new Date().toISOString().split("T")[0];
  const entry = `### ${date}\n${summary}`;

  const parsed = parseNoteSections(content);
  const sessionLog = parsed.sections.get("Session Log") || "";

  const cleanLog = sessionLog.replace("*No sessions recorded yet.*", "").trim();
  const newLog = cleanLog ? `${entry}\n\n${cleanLog}` : entry;
  parsed.sections.set("Session Log", newLog);

  let output = updateFrontmatterTimestamp(parsed.frontmatter) + "\n\n";
  output += `# ${parsed.title}\n\n`;
  for (const [name, sectionContent] of parsed.sections) {
    output += `## ${name}\n${sectionContent}\n\n`;
  }

  return output.trimEnd() + "\n";
}

// ─── File I/O ────────────────────────────────────────────────────────────────

export async function readNote(vaultPath, projectsFolder, projectName) {
  const filePath = notePath(vaultPath, projectsFolder, projectName);
  try {
    return await readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

export async function writeNote(vaultPath, projectsFolder, projectName, content) {
  const filePath = notePath(vaultPath, projectsFolder, projectName);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

export async function listProjectNotes(vaultPath, projectsFolder) {
  const dirPath = join(vaultPath, projectsFolder);
  try {
    const entries = await readdir(dirPath);
    const notes = [];
    for (const entry of entries) {
      if (!entry.endsWith(".md")) continue;
      const content = await readFile(join(dirPath, entry), "utf-8");
      const parsed = parseNoteSections(content);
      const statusMatch = parsed.frontmatter.match(/^status: (.+)$/m);
      const updatedMatch = parsed.frontmatter.match(/^updated: (.+)$/m);
      notes.push({
        name: entry.replace(".md", ""),
        status: statusMatch?.[1] || "unknown",
        updated: updatedMatch?.[1] || "unknown",
      });
    }
    return notes;
  } catch {
    return [];
  }
}
```

Write to `obsidian-sync/server/notes.js`.

- [ ] **Step 2: Commit**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add obsidian-sync/server/notes.js
git commit -m "feat(obsidian-sync): add note generation and parsing module"
```

---

### Task 7: Unit Tests for Note Utilities

**Files:**
- Create: `obsidian-sync/server/test/notes.test.js`

- [ ] **Step 1: Write the tests**

```javascript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  projectNameFromDir,
  generateFrontmatter,
  formatGitStatus,
  formatRecentCommits,
  formatOpenPRs,
  formatOpenIssues,
  formatTodos,
  parseNoteSections,
  updateNote,
  prependSessionLog,
  generateFullNote,
  updateFrontmatterTimestamp,
} from "../notes.js";

describe("projectNameFromDir", () => {
  it("converts hyphens to spaces with title case", () => {
    assert.equal(projectNameFromDir("car-deal-finder"), "Car Deal Finder");
  });

  it("preserves common abbreviations", () => {
    assert.equal(projectNameFromDir("ai-business-tools"), "AI Business Tools");
    assert.equal(projectNameFromDir("ai-claude-plugins"), "AI Claude Plugins");
    assert.equal(projectNameFromDir("hgwa-k8s-gitops"), "Hgwa K8S Gitops");
  });

  it("handles single word", () => {
    assert.equal(projectNameFromDir("homeassistant"), "Homeassistant");
  });
});

describe("generateFrontmatter", () => {
  it("includes all required fields", () => {
    const fm = generateFrontmatter({ repo: "https://github.com/test/repo" });
    assert.ok(fm.startsWith("---"));
    assert.ok(fm.endsWith("---"));
    assert.ok(fm.includes("date:"));
    assert.ok(fm.includes("updated:"));
    assert.ok(fm.includes("status: active"));
    assert.ok(fm.includes("repo: https://github.com/test/repo"));
    assert.ok(fm.includes("  - project"));
    assert.ok(fm.includes("  - auto-sync"));
  });

  it("omits repo when null", () => {
    const fm = generateFrontmatter({});
    assert.ok(!fm.includes("repo:"));
  });
});

describe("updateFrontmatterTimestamp", () => {
  it("updates the updated field", () => {
    const fm = "---\ndate: 2026-01-01\nupdated: 2026-01-01T00:00:00\nstatus: active\n---";
    const result = updateFrontmatterTimestamp(fm);
    assert.ok(!result.includes("2026-01-01T00:00:00"));
    assert.ok(result.includes("updated: 2026-"));
  });
});

describe("formatGitStatus", () => {
  it("formats clean status", () => {
    const result = formatGitStatus({
      branch: "main",
      lastCommit: { hash: "abc1234", message: "Fix bug", date: "2026-04-11" },
      uncommittedChanges: [],
    });
    assert.ok(result.includes("**Branch:** main"));
    assert.ok(result.includes('abc1234 — "Fix bug"'));
    assert.ok(result.includes("**Uncommitted changes:** none"));
  });

  it("formats dirty status with changes", () => {
    const result = formatGitStatus({
      branch: "feature/test",
      lastCommit: { hash: "def5678", message: "WIP", date: "2026-04-11" },
      uncommittedChanges: [" M src/index.ts", "?? new-file.js"],
    });
    assert.ok(result.includes("2 files"));
    assert.ok(result.includes("M src/index.ts"));
  });

  it("handles null last commit", () => {
    const result = formatGitStatus({
      branch: "main",
      lastCommit: null,
      uncommittedChanges: [],
    });
    assert.ok(result.includes("**Last commit:** none"));
  });
});

describe("formatRecentCommits", () => {
  it("formats as markdown table", () => {
    const result = formatRecentCommits([
      { date: "2026-04-11", hash: "abc1234", message: "Fix bug" },
      { date: "2026-04-10", hash: "def5678", message: "Add feature" },
    ]);
    assert.ok(result.includes("| Date | Hash | Message |"));
    assert.ok(result.includes("| 2026-04-11 | abc1234 | Fix bug |"));
  });

  it("handles empty commits", () => {
    assert.equal(formatRecentCommits([]), "No commits found.");
  });
});

describe("formatOpenPRs", () => {
  it("formats PRs with metadata", () => {
    const result = formatOpenPRs(
      [{ number: 12, title: "Add feature", isDraft: true, changedFiles: 3, reviewDecision: "" }],
      true
    );
    assert.ok(result.includes("**#12**"));
    assert.ok(result.includes("(draft)"));
    assert.ok(result.includes("(3 files)"));
  });

  it("shows no remote message", () => {
    assert.equal(formatOpenPRs(null, false), "No remote configured.");
  });

  it("shows gh cli unavailable message", () => {
    assert.equal(formatOpenPRs(null, true), "GitHub CLI not available — run `gh auth login` to enable.");
  });

  it("shows none for empty array", () => {
    assert.equal(formatOpenPRs([], true), "None.");
  });
});

describe("formatOpenIssues", () => {
  it("formats issues with labels", () => {
    const result = formatOpenIssues(
      [{ number: 8, title: "Token refresh bug", labels: [{ name: "bug" }] }],
      true
    );
    assert.ok(result.includes("**#8**"));
    assert.ok(result.includes("(bug)"));
  });
});

describe("formatTodos", () => {
  it("formats todo items", () => {
    const result = formatTodos([
      { file: "src/index.ts", line: "42", content: "// TODO: handle errors" },
    ]);
    assert.ok(result.includes("`src/index.ts:42`"));
  });

  it("handles empty todos", () => {
    assert.equal(formatTodos([]), "None found.");
  });
});

describe("parseNoteSections", () => {
  const sampleNote = [
    "---",
    "date: 2026-04-11",
    "updated: 2026-04-11T12:00:00",
    "status: active",
    "---",
    "",
    "# Test Project",
    "",
    "## Overview",
    "This is a test project.",
    "",
    "## Git Status",
    "- **Branch:** main",
    "",
    "## Session Log",
    "",
    "### 2026-04-11",
    "Did some work.",
  ].join("\n");

  it("extracts frontmatter", () => {
    const { frontmatter } = parseNoteSections(sampleNote);
    assert.ok(frontmatter.includes("date: 2026-04-11"));
    assert.ok(frontmatter.startsWith("---"));
  });

  it("extracts title", () => {
    const { title } = parseNoteSections(sampleNote);
    assert.equal(title, "Test Project");
  });

  it("extracts sections", () => {
    const { sections } = parseNoteSections(sampleNote);
    assert.ok(sections.has("Overview"));
    assert.ok(sections.has("Git Status"));
    assert.ok(sections.has("Session Log"));
    assert.equal(sections.get("Overview"), "This is a test project.");
  });
});

describe("updateNote", () => {
  const existingNote = [
    "---",
    "date: 2026-04-11",
    "updated: 2026-04-11T12:00:00",
    "status: active",
    "---",
    "",
    "# Test Project",
    "",
    "## Overview",
    "User-edited overview that should be preserved.",
    "",
    "## Tech Stack",
    "- **Runtime:** Node.js",
    "",
    "## Architecture",
    "- Entry: `src/app/`",
    "",
    "## Git Status",
    "- **Branch:** old-branch",
    "",
    "## Recent Commits",
    "Old commits here.",
    "",
    "## Open PRs",
    "Old PRs.",
    "",
    "## Active Issues",
    "Old issues.",
    "",
    "## TODOs in Code",
    "Old todos.",
    "",
    "## Session Log",
    "",
    "### 2026-04-10",
    "Previous session work.",
  ].join("\n");

  it("overwrites live sections", () => {
    const result = updateNote(existingNote, {
      gitStatus: { branch: "new-branch", lastCommit: { hash: "aaa", message: "New", date: "2026-04-11" }, uncommittedChanges: [] },
      recentCommits: [{ hash: "aaa", message: "New", date: "2026-04-11" }],
      openPRs: [],
      openIssues: [],
      todos: [],
      hasRemote: true,
    });
    assert.ok(result.includes("**Branch:** new-branch"));
    assert.ok(!result.includes("old-branch"));
    assert.ok(result.includes("| 2026-04-11 | aaa | New |"));
  });

  it("preserves Overview, Tech Stack, Architecture", () => {
    const result = updateNote(existingNote, {
      gitStatus: { branch: "main", lastCommit: null, uncommittedChanges: [] },
      recentCommits: [],
      openPRs: [],
      openIssues: [],
      todos: [],
      hasRemote: true,
    });
    assert.ok(result.includes("User-edited overview that should be preserved."));
    assert.ok(result.includes("**Runtime:** Node.js"));
    assert.ok(result.includes("Entry: `src/app/`"));
  });

  it("preserves Session Log", () => {
    const result = updateNote(existingNote, {
      gitStatus: { branch: "main", lastCommit: null, uncommittedChanges: [] },
      recentCommits: [],
      openPRs: [],
      openIssues: [],
      todos: [],
      hasRemote: true,
    });
    assert.ok(result.includes("Previous session work."));
  });
});

describe("prependSessionLog", () => {
  it("adds entry to empty session log", () => {
    const note = [
      "---",
      "date: 2026-04-11",
      "updated: 2026-04-11T12:00:00",
      "status: active",
      "---",
      "",
      "# Test",
      "",
      "## Session Log",
      "",
      "*No sessions recorded yet.*",
    ].join("\n");

    const result = prependSessionLog(note, "Did some great work today.");
    assert.ok(result.includes("### 2026-"));
    assert.ok(result.includes("Did some great work today."));
    assert.ok(!result.includes("*No sessions recorded yet.*"));
  });

  it("prepends to existing entries", () => {
    const note = [
      "---",
      "date: 2026-04-11",
      "updated: 2026-04-11T12:00:00",
      "status: active",
      "---",
      "",
      "# Test",
      "",
      "## Session Log",
      "",
      "### 2026-04-10",
      "Old entry.",
    ].join("\n");

    const result = prependSessionLog(note, "New entry.");
    const sessionIdx = result.indexOf("## Session Log");
    const newEntryIdx = result.indexOf("New entry.");
    const oldEntryIdx = result.indexOf("Old entry.");
    assert.ok(newEntryIdx < oldEntryIdx, "New entry should come before old entry");
  });
});
```

Write to `obsidian-sync/server/test/notes.test.js`.

- [ ] **Step 2: Run the tests**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && node --test test/notes.test.js`
Expected: All tests pass

- [ ] **Step 3: Fix any failures and re-run**

If any tests fail, fix the code in `notes.js` and re-run. Iterate until all pass.

- [ ] **Step 4: Commit**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add obsidian-sync/server/test/notes.test.js
git commit -m "test(obsidian-sync): add unit tests for note utilities"
```

---

### Task 8: MCP Server — Tool Definitions and Handler

**Files:**
- Create: `obsidian-sync/server/index.js`

- [ ] **Step 1: Write index.js**

```javascript
#!/usr/bin/env node
/**
 * Obsidian Sync MCP Server
 * Syncs git project state to Obsidian vault notes with session logging.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { basename } from "node:path";

import { discoverProjects, detectTechStack, detectArchitecture, generateOverview, extractTodos, detectDeployment } from "./discovery.js";
import { getGitBranch, getLastCommit, getUncommittedChanges, getRecentCommits, getRemoteUrl, parseOwnerRepo } from "./git.js";
import { getOpenPRs, getOpenIssues } from "./github.js";
import {
  projectNameFromDir, generateFrontmatter, generateFullNote,
  updateNote, prependSessionLog,
  readNote, writeNote, listProjectNotes,
} from "./notes.js";

// ─── Configuration ───────────────────────────────────────────────────────────

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH;
const PROJECTS_DIR = process.env.PROJECTS_DIR;
const PROJECTS_FOLDER = process.env.OBSIDIAN_PROJECTS_FOLDER || "Projects";

if (!VAULT_PATH || !PROJECTS_DIR) {
  console.error("Error: OBSIDIAN_VAULT_PATH and PROJECTS_DIR environment variables are required");
  process.exit(1);
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "obsidian_discover_projects",
    description:
      "Scan the projects directory for git repositories and return a list with metadata (name, path, remote URL, current branch)",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "obsidian_sync_project",
    description:
      "Full sync for a single project — gathers git status, commits, PRs, issues, TODOs, architecture and writes/updates the Obsidian project note",
    inputSchema: {
      type: "object",
      required: ["project_path"],
      properties: {
        project_path: {
          type: "string",
          description: "Absolute path to the git repository",
        },
        force_overwrite: {
          type: "boolean",
          description:
            "Regenerate all sections including Overview and Architecture (default: false)",
        },
      },
    },
  },
  {
    name: "obsidian_sync_all_projects",
    description: "Discover all git projects and sync each one to the Obsidian vault",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "obsidian_read_project_note",
    description:
      "Read a project note from the Obsidian vault and return its full Markdown content",
    inputSchema: {
      type: "object",
      required: ["project_name"],
      properties: {
        project_name: {
          type: "string",
          description:
            "Name of the project (matches the note filename, e.g. 'AI Business Tools')",
        },
      },
    },
  },
  {
    name: "obsidian_list_project_notes",
    description:
      "List all project notes in the Obsidian vault with their status and last updated timestamp",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "obsidian_append_session_log",
    description:
      "Append a narrative session log entry to a project note — captures what was done, decisions, reasoning, and what to pick up next",
    inputSchema: {
      type: "object",
      required: ["project_name", "summary"],
      properties: {
        project_name: {
          type: "string",
          description: "Name of the project (e.g. 'AI Business Tools')",
        },
        summary: {
          type: "string",
          description:
            "Narrative session summary: what was accomplished, key decisions, reasoning, blockers, what to pick up next",
        },
      },
    },
  },
];

// ─── Tool Implementations ────────────────────────────────────────────────────

async function syncSingleProject(projectPath, forceOverwrite = false) {
  const dirName = basename(projectPath);
  const projectName = projectNameFromDir(dirName);

  // Gather git data
  const branch = await getGitBranch(projectPath);
  const lastCommit = await getLastCommit(projectPath);
  const uncommittedChanges = await getUncommittedChanges(projectPath);
  const recentCommits = await getRecentCommits(projectPath);
  const remoteUrl = await getRemoteUrl(projectPath);
  const ownerRepo = parseOwnerRepo(remoteUrl);
  const hasRemote = !!remoteUrl;

  // Gather GitHub data (if available)
  const openPRs = ownerRepo ? await getOpenPRs(ownerRepo) : null;
  const openIssues = ownerRepo ? await getOpenIssues(ownerRepo) : null;

  // Gather code data
  const todos = await extractTodos(projectPath);

  const gitStatus = { branch, lastCommit, uncommittedChanges };

  // Check if note already exists
  const existing = await readNote(VAULT_PATH, PROJECTS_FOLDER, projectName);

  let content;
  if (existing && !forceOverwrite) {
    content = updateNote(existing, {
      gitStatus, recentCommits, openPRs, openIssues, todos, hasRemote,
    });
  } else {
    const overview = await generateOverview(projectPath);
    const techStack = await detectTechStack(projectPath);
    const architecture = await detectArchitecture(projectPath);
    const deployment = await detectDeployment(PROJECTS_DIR, dirName);
    const frontmatter = generateFrontmatter({ repo: remoteUrl });

    content = generateFullNote({
      projectName, frontmatter, overview, techStack, architecture,
      gitStatus, recentCommits, openPRs, openIssues, todos,
      deployment, hasRemote,
    });
  }

  const filePath = await writeNote(VAULT_PATH, PROJECTS_FOLDER, projectName, content);
  return { synced: projectName, path: filePath, isNew: !existing };
}

async function callTool(name, args) {
  switch (name) {
    case "obsidian_discover_projects": {
      return await discoverProjects(PROJECTS_DIR);
    }

    case "obsidian_sync_project": {
      return await syncSingleProject(args.project_path, args.force_overwrite || false);
    }

    case "obsidian_sync_all_projects": {
      const projects = await discoverProjects(PROJECTS_DIR);
      const results = [];
      for (const project of projects) {
        try {
          const result = await syncSingleProject(project.path);
          results.push({ project: project.name, status: "synced", ...result });
        } catch (err) {
          results.push({ project: project.name, status: "error", error: err.message });
        }
      }
      return { total: projects.length, results };
    }

    case "obsidian_read_project_note": {
      const content = await readNote(VAULT_PATH, PROJECTS_FOLDER, args.project_name);
      if (!content) throw new Error(`Project note "${args.project_name}" not found in vault`);
      return { name: args.project_name, content };
    }

    case "obsidian_list_project_notes": {
      return await listProjectNotes(VAULT_PATH, PROJECTS_FOLDER);
    }

    case "obsidian_append_session_log": {
      const existing = await readNote(VAULT_PATH, PROJECTS_FOLDER, args.project_name);
      if (!existing) throw new Error(`Project note "${args.project_name}" not found in vault`);
      const updated = prependSessionLog(existing, args.summary);
      const filePath = await writeNote(VAULT_PATH, PROJECTS_FOLDER, args.project_name, updated);
      return { appended: true, project: args.project_name, path: filePath };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── MCP Server ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: "obsidian-sync", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await callTool(name, args ?? {});
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

Write to `obsidian-sync/server/index.js`.

- [ ] **Step 2: Verify the server starts**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | OBSIDIAN_VAULT_PATH=/Users/pzharyuk/Documents/Obsidian/SecondBrain PROJECTS_DIR=/Users/pzharyuk/Documents/Claude/Projects timeout 5 node index.js 2>/dev/null || true`
Expected: JSON response listing the 6 tools

- [ ] **Step 3: Commit**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add obsidian-sync/server/index.js
git commit -m "feat(obsidian-sync): add MCP server with 6 tools"
```

---

### Task 9: Skills

**Files:**
- Create: `obsidian-sync/skills/configure/SKILL.md`
- Create: `obsidian-sync/skills/session-start/SKILL.md`
- Create: `obsidian-sync/skills/session-end/SKILL.md`

- [ ] **Step 1: Write configure skill**

```markdown
---
name: configure
description: >
  Use this skill when the user asks to "configure obsidian sync", "set up obsidian",
  "connect obsidian", or when the plugin is installed for the first time.
metadata:
  version: "0.1.0"
---

# Configure: obsidian-sync

Walk the user through setting up the Obsidian vault sync and run the initial project discovery.

## Steps

### 1. Confirm vault path
Ask: "What is the absolute path to your Obsidian vault? (e.g. ~/Documents/Obsidian/SecondBrain)"

Store as `OBSIDIAN_VAULT_PATH`.

### 2. Confirm projects directory
Ask: "What is the absolute path to the directory containing your git repositories? (e.g. ~/Documents/Claude/Projects)"

Store as `PROJECTS_DIR`.

### 3. Confirm projects folder (optional)
Ask: "What folder name within the vault should project notes be stored in? (default: Projects)"

Store as `OBSIDIAN_PROJECTS_FOLDER` (or use default `Projects`).

### 4. Write to ~/.mcp.json
Read `~/.mcp.json` (create if missing), set the env vars under the `obsidian-sync` server:

```json
{
  "mcpServers": {
    "obsidian-sync": {
      "env": {
        "OBSIDIAN_VAULT_PATH": "<value from step 1>",
        "PROJECTS_DIR": "<value from step 2>",
        "OBSIDIAN_PROJECTS_FOLDER": "<value from step 3>"
      }
    }
  }
}
```

### 5. Prompt reload
Say: "Configuration saved to ~/.mcp.json. Run `/reload-plugins` to apply."

### 6. Initial sync
After reload, call `obsidian_discover_projects` to show found projects, then call `obsidian_sync_all_projects` to generate initial notes.

Report what was created.

## Notes
- Expand `~` to the full home directory path before saving.
- Verify the vault path exists before saving.
```

Write to `obsidian-sync/skills/configure/SKILL.md`.

- [ ] **Step 2: Write session-start skill**

```markdown
---
name: session-start
description: >
  Use this skill at the start of a conversation when working in a git project directory.
  Syncs the project's Obsidian note with current state and loads it into context so Claude
  has full project history, recent commits, open PRs, and prior session notes.
metadata:
  version: "0.1.0"
---

# Session Start: obsidian-sync

Refresh the Obsidian project note with current data and load it into context.

## When to trigger

- At the beginning of a conversation when the working directory is inside a git project
- When the user switches to a different project mid-conversation

## Workflow

### 1. Detect the project
Determine which git project the current working directory belongs to by checking for a `.git` directory (walk up if needed).

### 2. Sync the project
Call `obsidian_sync_project` with the project's root path. This refreshes:
- Git status (current branch, last commit, uncommitted changes)
- Recent commits (last 20)
- Open PRs and issues (via GitHub CLI if available)
- TODOs/FIXMEs in the codebase

### 3. Load the note
Call `obsidian_read_project_note` with the project name (e.g. "AI Business Tools").

Review the note contents, paying special attention to:
- **Session Log** — what was done in prior sessions, what was planned next
- **Open PRs** — ongoing work that may be relevant
- **Active Issues** — known bugs or feature requests
- **TODOs in Code** — outstanding items in the codebase

### 4. Proceed
You now have full context. Continue with the user's request, informed by the project's history and current state.

## Notes
- If the project has no existing note, `obsidian_sync_project` creates one automatically.
- If `obsidian_sync_project` fails (e.g. vault path doesn't exist), warn the user and suggest running the configure skill.
- Do not block the conversation if sync fails — proceed with what context is available.
```

Write to `obsidian-sync/skills/session-start/SKILL.md`.

- [ ] **Step 3: Write session-end skill**

```markdown
---
name: session-end
description: >
  Use this skill when wrapping up a conversation or when the user says "done",
  "wrapping up", "that's all", "end session", or similar. Writes a narrative session
  log entry to the Obsidian project note and does a final sync.
metadata:
  version: "0.1.0"
---

# Session End: obsidian-sync

Capture what happened in this session and sync final state to the Obsidian vault.

## When to trigger

- User says they're done, wrapping up, or ending the session
- A natural end point in the conversation where significant work was completed
- Before switching to a different project

## Workflow

### 1. Compose the session narrative
Write a concise paragraph (3-6 sentences) covering:
- **What was accomplished** — specific features, fixes, or changes made
- **Key decisions and reasoning** — why a particular approach was chosen, trade-offs considered
- **Files and areas touched** — which parts of the codebase were modified
- **Blockers encountered** — any issues that came up and how they were resolved (or not)
- **What to pick up next** — clear handoff for the next session

Keep it factual and useful for future context. Write as if briefing yourself tomorrow.

### 2. Append the session log
Call `obsidian_append_session_log` with:
- `project_name`: the project's display name (e.g. "AI Business Tools")
- `summary`: the narrative from step 1

### 3. Final sync
Call `obsidian_sync_project` with the project's root path to refresh all live data one last time.

### 4. Confirm
Let the user know the session has been logged and the project note is up to date.

## Example session log entry

> Implemented the Stripe webhook handler for invoice payment confirmation. Chose to use
> Stripe's built-in webhook signature verification rather than a custom HMAC check —
> simpler and maintained by Stripe. Modified `src/plugins/stripe/webhook.ts` and added
> the new route in `src/app/api/webhooks/stripe/route.ts`. Hit an issue with the raw
> body parsing in Next.js App Router — resolved by using `request.text()` instead of
> `request.json()`. Next session: wire up partial payment handling and add retry logic
> for failed webhook deliveries.

## Notes
- One log entry per session, even if multiple topics were covered.
- If no meaningful work was done (just questions/exploration), still log a brief note about what was discussed.
- The entry is prepended (most recent first) to the Session Log section.
```

Write to `obsidian-sync/skills/session-end/SKILL.md`.

- [ ] **Step 4: Commit**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add obsidian-sync/skills/
git commit -m "feat(obsidian-sync): add configure, session-start, and session-end skills"
```

---

### Task 10: README and Marketplace Registration

**Files:**
- Create: `obsidian-sync/README.md`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: Write README.md**

```markdown
# obsidian-sync

Automatic Obsidian vault sync for git projects. Keeps living Markdown notes in your vault that track git status, commits, PRs, issues, TODOs, architecture, and a narrative session log of every Claude Code conversation.

## Components

| Component | Description |
|-----------|-------------|
| MCP Server | 6 tools for project discovery, sync, reading, and session logging |
| Skills | configure, session-start, session-end |

## Available Tools (6)

### Discovery & Sync
- **obsidian_discover_projects** — scan projects directory for git repos
- **obsidian_sync_project** — full sync for a single project (git, PRs, issues, TODOs → note)
- **obsidian_sync_all_projects** — discover and sync all projects

### Reading
- **obsidian_read_project_note** — read a project note from the vault
- **obsidian_list_project_notes** — list all project notes with status

### Session Logging
- **obsidian_append_session_log** — append a narrative session entry to a project note

## Setup

### 1. Install the plugin
```bash
/plugin install obsidian-sync@ai-claude-plugins
```

### 2. Configure
Run the configure skill or manually set these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `OBSIDIAN_VAULT_PATH` | yes | Absolute path to your Obsidian vault |
| `PROJECTS_DIR` | yes | Absolute path to directory containing git repos |
| `OBSIDIAN_PROJECTS_FOLDER` | no | Folder in vault for project notes (default: `Projects`) |

### 3. Initial sync
After configuration, run `obsidian_sync_all_projects` to generate notes for all your projects.

## How It Works

- **Session start:** Refreshes project note with current git state, commits, PRs, issues, and TODOs. Loads the note into Claude's context for full project awareness.
- **Session end:** Appends a narrative log entry capturing what was done, decisions made, and what to pick up next. Final data refresh.
- **Live sections** (Git Status, Commits, PRs, Issues, TODOs) are overwritten every sync.
- **Preserved sections** (Overview, Tech Stack, Architecture, Deployment) are only generated on first sync — edit freely in Obsidian.
- **Session Log** is append-only — never overwritten.

## Requirements

- Node.js 18+
- `git` CLI
- `gh` CLI (optional — for PR/issue tracking)
```

Write to `obsidian-sync/README.md`.

- [ ] **Step 2: Update marketplace.json**

Add the obsidian-sync entry to the `plugins` array in `.claude-plugin/marketplace.json`:

```json
{
  "name": "obsidian-sync",
  "source": "./obsidian-sync",
  "description": "Automatic Obsidian vault sync — tracks git status, commits, PRs, issues, TODOs, architecture, and session logs as living project notes.",
  "version": "0.1.0",
  "author": { "name": "Pzharyuk" },
  "repository": "https://github.com/Pzharyuk/ai-claude-plugins",
  "keywords": ["obsidian", "sync", "git", "second-brain", "knowledge-management"]
}
```

Append this to the end of the `plugins` array in `.claude-plugin/marketplace.json`.

- [ ] **Step 3: Commit**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add obsidian-sync/README.md .claude-plugin/marketplace.json
git commit -m "feat(obsidian-sync): add README and marketplace registration"
```

---

### Task 11: Integration Test — Sync Real Projects

**Files:** none (manual verification)

- [ ] **Step 1: Run all unit tests**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && npm test`
Expected: All tests pass

- [ ] **Step 2: Run discover_projects manually**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && node -e "import('./discovery.js').then(async m => console.log(JSON.stringify(await m.discoverProjects('/Users/pzharyuk/Documents/Claude/Projects'), null, 2)))"`
Expected: 5 projects listed with correct names, paths, remotes, and branches

- [ ] **Step 3: Run full sync against real vault**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && OBSIDIAN_VAULT_PATH=/Users/pzharyuk/Documents/Obsidian/SecondBrain PROJECTS_DIR=/Users/pzharyuk/Documents/Claude/Projects node -e "
import { discoverProjects } from './discovery.js';
import { basename } from 'node:path';
import { getGitBranch, getLastCommit, getUncommittedChanges, getRecentCommits, getRemoteUrl, parseOwnerRepo } from './git.js';
import { getOpenPRs, getOpenIssues } from './github.js';
import { detectTechStack, detectArchitecture, generateOverview, extractTodos, detectDeployment } from './discovery.js';
import { projectNameFromDir, generateFrontmatter, generateFullNote, writeNote } from './notes.js';

const VAULT = process.env.OBSIDIAN_VAULT_PATH;
const PROJECTS = process.env.PROJECTS_DIR;

const projects = await discoverProjects(PROJECTS);
for (const p of projects) {
  const dirName = basename(p.path);
  const name = projectNameFromDir(dirName);
  const branch = await getGitBranch(p.path);
  const lastCommit = await getLastCommit(p.path);
  const uncommitted = await getUncommittedChanges(p.path);
  const commits = await getRecentCommits(p.path);
  const remote = await getRemoteUrl(p.path);
  const ownerRepo = parseOwnerRepo(remote);
  const prs = ownerRepo ? await getOpenPRs(ownerRepo) : null;
  const issues = ownerRepo ? await getOpenIssues(ownerRepo) : null;
  const todos = await extractTodos(p.path);
  const overview = await generateOverview(p.path);
  const tech = await detectTechStack(p.path);
  const arch = await detectArchitecture(p.path);
  const deploy = await detectDeployment(PROJECTS, dirName);
  const fm = generateFrontmatter({ repo: remote });
  const note = generateFullNote({
    projectName: name, frontmatter: fm, overview, techStack: tech, architecture: arch,
    gitStatus: { branch, lastCommit, uncommittedChanges: uncommitted },
    recentCommits: commits, openPRs: prs, openIssues: issues, todos, deployment: deploy,
    hasRemote: !!remote,
  });
  const path = await writeNote(VAULT, 'Projects', name, note);
  console.log('Created:', path);
}
"`
Expected: 5 notes created in `/Users/pzharyuk/Documents/Obsidian/SecondBrain/Projects/`

- [ ] **Step 4: Verify notes in Obsidian**

Open Obsidian and check:
- 5 new notes exist in the Projects folder
- Each has proper frontmatter with tags, status, repo
- Sections are populated: Overview, Tech Stack, Architecture, Git Status, Recent Commits, etc.
- Session Log shows "*No sessions recorded yet.*"

- [ ] **Step 5: Test session log append**

Run: `cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins/obsidian-sync/server && OBSIDIAN_VAULT_PATH=/Users/pzharyuk/Documents/Obsidian/SecondBrain PROJECTS_DIR=/Users/pzharyuk/Documents/Claude/Projects node -e "
import { prependSessionLog, readNote, writeNote } from './notes.js';
const content = await readNote('/Users/pzharyuk/Documents/Obsidian/SecondBrain', 'Projects', 'AI Business Tools');
const updated = prependSessionLog(content, 'Test session log entry. Built the obsidian-sync plugin to auto-track project state. Decided on direct filesystem writes over REST API. Next: install the plugin and test end-to-end.');
await writeNote('/Users/pzharyuk/Documents/Obsidian/SecondBrain', 'Projects', 'AI Business Tools', updated);
console.log('Session log appended.');
"`
Expected: "Session log appended." and the note in Obsidian now has the entry under Session Log.

- [ ] **Step 6: Install the plugin and verify**

Run: `claude plugin install obsidian-sync@ai-claude-plugins`
Expected: Plugin installed successfully. `obsidian_*` tools available in tool list.

- [ ] **Step 7: Final commit**

```bash
cd /Users/pzharyuk/Documents/Claude/Projects/ai-claude-plugins
git add -A obsidian-sync/
git commit -m "feat(obsidian-sync): complete plugin — ready for use"
```
