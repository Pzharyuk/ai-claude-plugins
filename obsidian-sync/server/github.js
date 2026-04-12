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
