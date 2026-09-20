import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { requireFreePort, startProcess, stopProcess } from "./processes.mjs";
import { brotliCompressSync } from "node:zlib";

const root = new URL("../", import.meta.url).pathname;
const output = resolve(root, "benchmarks/results/parity");
mkdirSync(output, { recursive: true });
execFileSync(process.execPath, [resolve(root, "benchmarks/run.mjs")], {
  env: { ...process.env, ENGINES: "baseline,truss", RUNS: "1", COUNTS: "0", AXIS: "files", SCENARIOS: "build" },
  stdio: "inherit",
});
const baseCss = css("baseline");
if (!baseCss.equals(css("truss"))) throw new Error("Production stylesheet differs from the saved baseline");
const baselineJs = clientJs("baseline");
const candidateJs = clientJs("truss");
if (candidateJs.brotli > baselineJs.brotli) throw new Error("Compressed client JavaScript grew");
writeFileSync(resolve(output, "assets.json"), JSON.stringify({ baselineJs, candidateJs }, null, 2) + "\n");
const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "chromium" });
const screenshots = new Map();
const htmlClasses = new Map();
const report = [];
try {
  for (const engine of ["baseline", "truss"]) {
    await requireFreePort(4198);
    const server = startProcess("npm", ["start"], {
      cwd: directory(engine),
      env: { ...process.env, PORT: "4198" },
      detached: true,
      stdio: "pipe",
    });
    let logs = "";
    server.stdout.on("data", (chunk) => {
      logs += chunk;
    });
    server.stderr.on("data", (chunk) => {
      logs += chunk;
    });
    try {
      await ready(server, () => logs);
      for (const width of [390, 1280]) {
        for (const colorScheme of ["light", "dark"]) {
          const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme });
          // Font availability must not vary with the network between the two engines.
          await context.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, (route) => route.abort());
          const page = await context.newPage();
          const errors = [];
          page.on("pageerror", (error) => errors.push(error.message));
          for (const route of ["/", "/projects", "/settings", "/pricing", "/docs", "/lab"]) {
            const response = await page.goto(`http://localhost:4198${route}`, { waitUntil: "networkidle" });
            const html = await response.text();
            const classes = [...html.matchAll(/\bclass="([^"]*)"/g)].map((match) => match[1]);
            if (engine === "baseline") htmlClasses.set(route, classes);
            else if (JSON.stringify(classes) !== JSON.stringify(htmlClasses.get(route)))
              throw new Error(`SSR classes changed: ${route}`);
            await page.addStyleTag({
              content:
                "*, *::before, *::after { animation: none !important; transition: none !important; caret-color: transparent !important; }",
            });
            const key = `${width}-${colorScheme}-${route === "/" ? "dashboard" : route.slice(1)}`;
            const bytes = await page.screenshot({ fullPage: true, animations: "disabled" });
            writeFileSync(resolve(output, `${engine}-${key}.png`), bytes);
            const image = PNG.sync.read(bytes);
            if (engine === "baseline") screenshots.set(key, image);
            else {
              const original = screenshots.get(key);
              if (original.width !== image.width || original.height !== image.height)
                throw new Error(`Geometry changed: ${key}`);
              let pixels = 0;
              for (let i = 0; i < image.data.length; i += 4) {
                if (!image.data.subarray(i, i + 4).equals(original.data.subarray(i, i + 4))) pixels++;
              }
              // Chromium can rasterize rounded header edges a few shades differently after
              // scrolling. Report raw differences but use pixelmatch's antialias detection.
              const materialDifferences = pixelmatch(original.data, image.data, undefined, image.width, image.height, {
                threshold: 0.1,
              });
              report.push({
                key,
                differingPixels: pixels,
                materialDifferences,
                ssrClassBytes: classes.reduce((sum, value) => sum + Buffer.byteLength(value), 0),
              });
              if (materialDifferences) throw new Error(`Screenshot changed: ${key} (${materialDifferences} pixels)`);
            }
          }
          if (errors.length) throw new Error(errors.join("\n"));
          await context.close();
        }
      }
    } finally {
      await stopProcess(server);
    }
  }
} finally {
  await browser.close();
}
writeFileSync(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(
  `CSS and SSR classes identical; client JS Brotli ${baselineJs.brotli} → ${candidateJs.brotli} bytes; ${report.length} screenshots match (pixelmatch threshold 0.1); no browser errors.`,
);

/** Locate a disposable application prepared by the benchmark runner. */
function directory(engine) {
  return resolve(root, "benchmarks/.work", engine === "baseline" ? "app-baseline" : "app-truss");
}

/** Read every production stylesheet in deterministic order. */
function css(engine) {
  const dir = resolve(directory(engine), "build/client/assets");
  return Buffer.concat(
    readdirSync(dir)
      .filter((name) => name.endsWith(".css"))
      .sort()
      .map((name) => readFileSync(resolve(dir, name))),
  );
}

/** Sum compressed sizes per emitted client chunk, rather than compressing all chunks as one response. */
function clientJs(engine) {
  const dir = resolve(directory(engine), "build/client/assets");
  const assets = readdirSync(dir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => readFileSync(resolve(dir, name)));
  return {
    raw: assets.reduce((sum, asset) => sum + asset.length, 0),
    brotli: assets.reduce((sum, asset) => sum + brotliCompressSync(asset).length, 0),
  };
}

/** Validate a rendered response before taking screenshots. */
async function ready(server, logs) {
  const start = performance.now();
  while (performance.now() - start < 30000) {
    if (server.exitCode !== null) throw new Error(logs());
    try {
      const response = await fetch("http://localhost:4198/");
      if (response.ok && (await response.text()).includes("Recent activity")) return;
    } catch {}
    await new Promise((done) => setTimeout(done, 50));
  }
  throw new Error(`Production server did not start: ${logs()}`);
}
