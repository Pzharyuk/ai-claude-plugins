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
