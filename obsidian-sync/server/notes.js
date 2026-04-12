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

  parsed.sections.set("Git Status", formatGitStatus(newData.gitStatus));
  parsed.sections.set("Recent Commits", formatRecentCommits(newData.recentCommits));
  parsed.sections.set("Open PRs", formatOpenPRs(newData.openPRs, newData.hasRemote));
  parsed.sections.set("Active Issues", formatOpenIssues(newData.openIssues, newData.hasRemote));
  parsed.sections.set("TODOs in Code", formatTodos(newData.todos));

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
