import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { onExit, requireFreePort, startProcess, stopProcess } from "./processes.mjs";

const root = new URL("../", import.meta.url).pathname;
const engines = (
  process.env.ENGINES ??
  (existsSync(resolve(root, "benchmarks/.work/baseline")) ? "baseline,truss,tailwind" : "truss,tailwind")
).split(",");
const sweeps = Number(process.env.SWEEPS ?? 4);
const pairs = Number(process.env.PAIRS ?? 5);
const port = 4198;
const rows = [];
const serverRows = [];
const resultName = `${new Date().toISOString().replaceAll(":", "-")}-hmr.json`;
// Prepare normal installed packages and reset the file-count fixture before booting a browser.
execFileSync(process.execPath, [resolve(root, "benchmarks/run.mjs")], {
  env: { ...process.env, ENGINES: engines.join(","), RUNS: "1", COUNTS: "0", SCENARIOS: "" },
  stdio: "inherit",
});
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chromium" });
try {
  for (let sweep = 0; sweep < sweeps; sweep++) {
    for (const engine of sweep % 2 === 0 ? engines : [...engines].reverse()) {
      const dir = resolve(root, "benchmarks/.work", engine === "baseline" ? "app-baseline" : `app-${engine}`);
      await requireFreePort(port);
      const server = startProcess("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
        cwd: dir,
        detached: true,
        stdio: "pipe",
      });
      let output = "";
      server.stdout.on("data", (chunk) => {
        output += chunk;
      });
      server.stderr.on("data", (chunk) => {
        output += chunk;
      });
      const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      try {
        await waitForServer(server, () => output);
        if (process.env.SERVER === "1") await measureServer(engine, dir, sweep);
        await context.addInitScript(() => {
          const Original = window.WebSocket;
          window.__benchmarkUpdates = [];
          window.WebSocket = class extends Original {
            constructor(url, protocols) {
              super(url, protocols);
              this.addEventListener("message", (event) => {
                if (typeof event.data !== "string") return;
                const payload = JSON.parse(event.data);
                if (payload.type === "update" || payload.type === "full-reload") {
                  window.__benchmarkUpdates.push(performance.timeOrigin + performance.now());
                }
              });
            }
          };
        });
        const page = await context.newPage();
        await page.goto(`http://localhost:${port}/`, { waitUntil: "networkidle" });
        await sleep(3000);
        for (const kind of ["shared", "leaf"]) {
          const shared = kind === "shared";
          const file = resolve(dir, "app", shared ? "ui.ts" : "routes/dashboard.tsx");
          const original = readFileSync(file, "utf8");
          const restored = onExit(() => writeFileSync(file, original));
          const base = shared ? 25 : 23;
          const selector = shared ? "h1" : "article span + span";
          const anchor =
            engine === "tailwind"
              ? `${shared ? 'export const pageTitle = "text-' : '  kpiValue: "text-'}${base}`
              : `${shared ? "export const pageTitle = Css.f" : "  kpiValue: Css.f"}${base}`;
          if (original.split(anchor).length !== 2) throw new Error(`Expected one edit anchor in ${file}`);
          try {
            for (let pair = -1; pair < pairs; pair++) {
              // Unique values across both edit kinds prevent an accumulated dev rule from winning early.
              const value = pair === -1 ? (shared ? 901 : 902) : 41 + (shared ? 0 : 100) + sweep * pairs + pair;
              const replacement =
                engine === "tailwind"
                  ? `${shared ? 'export const pageTitle = "text-' : '  kpiValue: "text-'}[${value}px]`
                  : `${shared ? "export const pageTitle = Css." : "  kpiValue: Css."}fsPx(${value})`;
              await page.evaluate(armDetector, { selector, expected: `${value}px` });
              const written = performance.timeOrigin + performance.now();
              writeFileSync(file, original.replace(anchor, replacement));
              const result = await page.evaluate(() => window.__trussBenchmark);
              if (result.error) throw new Error(`${engine}/${kind}: ${result.error}`);
              const row = { engine, sweep, kind, pair, ...result };
              for (const key of ["correct", "cssLive", "js", "browserUpdate"])
                row[key] = result[key] === null ? null : result[key] - written;
              await sleep(700);
              const payload = await page.evaluate(() => {
                const resources = performance.getEntriesByType("resource");
                return {
                  requests: resources.length,
                  bytes: resources.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
                };
              });
              Object.assign(row, payload);
              if (pair >= 0) {
                rows.push(row);
                console.log(JSON.stringify(row));
              }
            }
          } finally {
            writeFileSync(file, original);
            restored();
            await sleep(1600);
          }
        }
      } finally {
        await context.close();
        await stopProcess(server);
      }
      const report =
        JSON.stringify(
          { node: process.version, browser: browser.version(), sweeps, pairs, serverRows, rows },
          null,
          2,
        ) + "\n";
      writeFileSync(resolve(root, "benchmarks/results/hmr-latest.json"), report);
      writeFileSync(resolve(root, "benchmarks/results", resultName), report);
    }
  }
} finally {
  await browser.close();
}
for (const engine of engines) {
  for (const kind of ["shared", "leaf"]) {
    const values = rows
      .filter((row) => row.engine === engine && row.kind === kind)
      .map((row) => row.correct)
      .sort((a, b) => a - b);
    console.log(
      engine,
      kind,
      "correct median ms",
      (values[Math.floor(values.length / 2)] + values[Math.floor((values.length - 1) / 2)]) / 2,
    );
  }
}

/** Use the arena's exact-value detector; inherited fallback styles never count as success. */
function armDetector(args) {
  window.__benchmarkUpdates = [];
  const before = document.querySelector(args.selector).getAttribute("class");
  const started = performance.now();
  performance.clearResourceTimings();
  window.__trussBenchmark = new Promise((done) => {
    const channel = new MessageChannel();
    const result = { correct: null, cssLive: null, js: null };
    let lastScan = 0;
    channel.port1.onmessage = () => {
      const time = performance.now();
      const epoch = performance.timeOrigin + time;
      const element = document.querySelector(args.selector);
      if (element) {
        if (result.js === null && element.getAttribute("class") !== before) result.js = epoch;
        if (result.correct === null && getComputedStyle(element).fontSize === args.expected) result.correct = epoch;
      }
      if (result.cssLive === null && time - lastScan >= 2) {
        lastScan = time;
        const stack = [];
        for (const sheet of document.styleSheets) {
          try {
            stack.push(...sheet.cssRules);
          } catch {}
        }
        while (stack.length) {
          const rule = stack.pop();
          if (rule.style?.fontSize === args.expected) result.cssLive = epoch;
          if (rule.cssRules) stack.push(...rule.cssRules);
        }
      }
      if ((result.correct !== null && result.cssLive !== null && result.js !== null) || time - started > 15000) {
        channel.port1.close();
        channel.port2.close();
        const resources = performance.getEntriesByType("resource").filter((entry) => entry.startTime >= started);
        done({
          ...result,
          browserUpdate: window.__benchmarkUpdates[0] ?? null,
          requests: resources.length,
          bytes: resources.reduce((sum, entry) => sum + entry.encodedBodySize, 0),
          ...(result.correct === null ? { error: "Exact style did not arrive" } : {}),
        });
        return;
      }
      channel.port2.postMessage(0);
    };
    channel.port2.postMessage(0);
  });
}

/** Wait for the app's rendered content and fail promptly when the server exits. */
async function waitForServer(server, output) {
  const start = performance.now();
  while (performance.now() - start < 60000) {
    if (server.exitCode !== null) throw new Error(output());
    try {
      const response = await fetch(`http://localhost:${port}/`);
      if (response.ok && (await response.text()).includes("Recent activity")) return;
    } catch {}
    await sleep(50);
  }
  throw new Error(`Server did not start: ${output()}`);
}

/** Let the previous update settle before the next timed edit. */
function sleep(ms) {
  return new Promise((done) => setTimeout(done, ms));
}

/** Match arena's browserless component-edit probe: only update/full-reload payloads count. */
async function measureServer(engine, dir, sweep) {
  const file = resolve(dir, "app/routes/dashboard.tsx");
  const original = readFileSync(file, "utf8");
  const restored = onExit(() => writeFileSync(file, original));
  const anchor = engine === "tailwind" ? '  kpiValue: "text-23' : "  kpiValue: Css.f23";
  const socket = new WebSocket(`ws://localhost:${port}`, "vite-hmr");
  await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(new Error("HMR socket did not open")), 5000);
    socket.addEventListener(
      "open",
      () => {
        clearTimeout(timeout);
        done();
      },
      { once: true },
    );
    socket.addEventListener("error", reject, { once: true });
  });
  try {
    await sleep(1500);
    for (let pair = 0; pair < pairs; pair++) {
      let written;
      const update = new Promise((done, reject) => {
        const timeout = setTimeout(() => {
          socket.removeEventListener("message", receive);
          done(null);
        }, 12000);
        /** Ignore connection chatter and custom notifications, as the arena does. */
        function receive(event) {
          if (written === undefined) return;
          const payload = JSON.parse(String(event.data));
          if (payload.type !== "update" && payload.type !== "full-reload") return;
          clearTimeout(timeout);
          socket.removeEventListener("message", receive);
          done(performance.now() - written);
        }
        socket.addEventListener("message", receive);
      });
      const value = 501 + sweep * pairs + pair;
      const replacement = engine === "tailwind" ? `  kpiValue: "text-[${value}px]` : `  kpiValue: Css.fsPx(${value})`;
      written = performance.now();
      writeFileSync(file, original.replace(anchor, replacement));
      const ms = await update;
      const row = { engine, sweep, pair, ms };
      serverRows.push(row);
      console.log("server", JSON.stringify(row));
      if (ms === null) break;
      await sleep(700);
    }
  } finally {
    writeFileSync(file, original);
    restored();
    socket.close();
    await sleep(1000);
  }
}
