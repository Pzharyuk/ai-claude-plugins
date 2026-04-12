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

  if (dirs.includes("backend") && dirs.includes("frontend")) {
    lines.push("- **Structure:** Monorepo (`backend/` + `frontend/`)");
  }

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

  if (dirs.includes("charts")) lines.push("- Helm Charts: `charts/`");
  if (dirs.includes("apps")) lines.push("- ArgoCD Apps: `apps/`");
  if (dirs.includes("config")) lines.push("- Config: `config/`");
  if (dirs.includes("tests")) lines.push("- Tests: `tests/`");
  if (dirs.includes("pipeline")) lines.push("- Pipeline: `pipeline/`");

  if (!lines.length) {
    lines.push(`- Directories: ${dirs.slice(0, 10).map((d) => "\`" + d + "/\`").join(", ")}`);
  }

  return lines.join("\n") || "Not detected";
}

export async function generateOverview(projectPath) {
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
