import { spawn } from "node:child_process";
import { createServer } from "node:net";

const children = new Set();
const cleanups = new Set();
process.once("exit", () => {
  for (const cleanup of cleanups) cleanup();
  for (const child of children) signal(child, "SIGKILL");
});
process.once("SIGINT", () => process.exit(130));
process.once("SIGTERM", () => process.exit(143));

/** Refuse a busy port so readiness cannot accidentally measure an unrelated server. */
export async function requireFreePort(port) {
  const server = createServer();
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(port, "::", done);
  });
  await new Promise((done, reject) => server.close((error) => (error ? reject(error) : done())));
}

/** Own the complete npm/framework process group, including on interrupted benchmark runs. */
export function startProcess(command, args, options) {
  const child = spawn(command, args, { ...options, detached: true });
  children.add(child);
  child.on("error", (error) => {
    throw error;
  });
  return child;
}

/** Stop framework children as well as the npm wrapper before another sample starts. */
export async function stopProcess(child) {
  signal(child, "SIGTERM");
  await new Promise((done) => setTimeout(done, 500));
  signal(child, "SIGKILL");
  children.delete(child);
}

/** Register source restoration for SIGINT/SIGTERM as well as normal finally blocks. */
export function onExit(cleanup) {
  cleanups.add(cleanup);
  return () => cleanups.delete(cleanup);
}

/** The process may already have exited by the time cleanup runs. */
function signal(child, name) {
  try {
    process.kill(-child.pid, name);
  } catch {}
}
