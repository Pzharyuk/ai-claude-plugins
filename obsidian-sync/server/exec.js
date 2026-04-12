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
