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
