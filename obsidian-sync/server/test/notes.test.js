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
