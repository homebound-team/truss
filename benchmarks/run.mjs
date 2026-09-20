import { spawnSync } from "node:child_process";
import { requireFreePort, startProcess, stopProcess } from "./processes.mjs";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { brotliCompressSync, gzipSync } from "node:zlib";
import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { cpus } from "node:os";
import { precompile } from "./precompiled.mjs";

const root = new URL("../", import.meta.url).pathname;
const work = resolve(root, "benchmarks/.work");
const runs = Number(process.env.RUNS ?? 5);
const axis = process.env.AXIS ?? "files";
const counts = (process.env.COUNTS ?? (axis === "styles" ? "0,50,200,800" : "0,400,1600")).split(",").map(Number);
const engines = (
  process.env.ENGINES ?? (existsSync(resolve(work, "baseline")) ? "baseline,truss,tailwind" : "truss,tailwind")
).split(",");
const scenarios = (process.env.SCENARIOS ?? "build,start").split(",");
const results = [];
const resultName = `${new Date().toISOString().replaceAll(":", "-")}-${axis}-${process.env.ORPHANED === "1" ? "orphaned" : "imported"}.json`;
mkdirSync(work, { recursive: true });
mkdirSync(resolve(root, "benchmarks/results"), { recursive: true });

if (process.argv.includes("--save-baseline")) {
  const baseline = resolve(work, "baseline");
  if (existsSync(baseline)) throw new Error("Baseline already exists; keep it for paired comparisons.");
  cpSync(resolve(root, "packages/truss/build"), baseline, { recursive: true });
}
if (!Number.isInteger(runs) || runs < 1 || counts.some((count) => !Number.isInteger(count) || count < 0))
  throw new Error("RUNS must be positive and COUNTS must be nonnegative integers");
if (!engines.every((engine) => ["baseline", "truss", "tailwind", "precompiled"].includes(engine)))
  throw new Error("Unknown engine");

// Each process uses the same installed fixture dependencies. Only the Truss plugin/runtime change.
for (const engine of engines) prepare(engine);
for (const count of counts) {
  for (const engine of engines) {
    if (engine === "precompiled")
      cpSync(resolve(root, "benchmarks/fixtures/truss/app"), resolve(directory(engine), "app"), { recursive: true });
    scale(engine, count);
    if (engine === "precompiled") await precompile(directory(engine));
  }
  for (let run = 0; run < runs; run++) {
    for (const engine of run % 2 === 0 ? engines : [...engines].reverse()) {
      const dir = directory(engine);
      const row = { engine, axis, count, run };
      if (scenarios.includes("build")) {
        for (const cache of ["cold", "warm"]) {
          if (cache === "cold") clean(dir);
          const start = performance.now();
          command("npm", ["run", "build"], dir);
          row[cache] = performance.now() - start;
        }
        row.css = cssSize(resolve(dir, "build/client/assets"));
      }
      if (scenarios.includes("start")) row.start = await startOnce(dir, 4198);
      results.push(row);
      console.log(JSON.stringify(row));
      if (scenarios.some(Boolean)) {
        const report =
          JSON.stringify(
            {
              node: process.version,
              platform: process.platform,
              cpu: cpus()[0].model,
              compilerHash: createHash("sha256")
                .update(readFileSync(resolve(root, "packages/truss/build/plugin/index.js")))
                .digest("hex"),
              baselineCompilerHash: existsSync(resolve(work, "baseline/plugin/index.js"))
                ? createHash("sha256")
                    .update(readFileSync(resolve(work, "baseline/plugin/index.js")))
                    .digest("hex")
                : undefined,
              versions: Object.fromEntries(engines.map((name) => [name, versions(directory(name))])),
              axis,
              orphaned: process.env.ORPHANED === "1",
              runs,
              counts,
              results,
            },
            null,
            2,
          ) + "\n";
        writeFileSync(resolve(root, "benchmarks/results", resultName), report);
        writeFileSync(resolve(root, "benchmarks/results/latest.json"), report);
      }
    }
  }
}
for (const count of counts) {
  for (const engine of engines) {
    const rows = results.filter((row) => row.engine === engine && row.count === count);
    console.log(
      engine,
      count,
      Object.fromEntries(["cold", "warm", "start"].map((key) => [key, median(rows.map((row) => row[key]))])),
    );
  }
}

/** Run a command and surface failures instead of recording a fast failed build. */
function command(executable, args, cwd) {
  const result = spawnSync(executable, args, { cwd, encoding: "utf8", timeout: 180000 });
  if (result.status !== 0)
    throw new Error(`${executable} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

/** Keep the published package installed but select the local compiler explicitly. */
function prepare(engine) {
  const dir = directory(engine);
  if (!existsSync(resolve(dir, "node_modules"))) command("npm", ["ci", "--no-audit", "--no-fund"], dir);
  const original = readFileSync(resolve(dir, "vite.config.ts"), "utf8");
  if (engine === "tailwind") {
    // In a Yarn monorepo Tailwind otherwise discovers the enclosing workspace and scans
    // Truss's tests too. Keep the same app-sized source boundary as the standalone arena.
    const css = readFileSync(resolve(root, "benchmarks/fixtures/tailwind/app/app.css"), "utf8");
    writeFileSync(
      resolve(dir, "app/app.css"),
      css.replace('@import "tailwindcss";', '@import "tailwindcss" source(none);\n@source "./";'),
    );
  }
  const build = engine === "baseline" ? resolve(work, "baseline") : resolve(root, "packages/truss/build");
  if (engine !== "tailwind") {
    // Exercise normal package resolution, including React and Vite dependency optimization.
    // An absolute alias outside this app would introduce a second copy of React.
    cpSync(build, resolve(dir, "node_modules/@homebound/truss/build"), { recursive: true });
  }
  writeFileSync(
    resolve(dir, "benchmark.config.ts"),
    process.env.PROFILE && engine !== "tailwind" ? profileConfig(original) : original,
  );
  // The fixture stays identical; select the benchmark config through the usual Vite CLI.
  const pkg = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));
  pkg.scripts.build = "react-router build --config benchmark.config.ts";
  pkg.scripts.dev = "react-router dev --config benchmark.config.ts";
  writeFileSync(resolve(dir, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
}

/** Copy fixtures into disposable worktrees so edits and build caches cannot dirty them. */
function directory(engine) {
  const dir = resolve(work, engine === "baseline" ? "app-baseline" : `app-${engine}`);
  if (!existsSync(dir))
    cpSync(resolve(root, "benchmarks/fixtures", engine === "tailwind" ? "tailwind" : "truss"), dir, {
      recursive: true,
    });
  return dir;
}

/** Match arena dev-scale: four identical declarations in every imported source file. */
function scale(engine, count) {
  const dir = directory(engine);
  const generated = resolve(dir, "app/__devscale");
  rmSync(generated, { recursive: true, force: true });
  rmSync(resolve(dir, "app/__scale.ts"), { force: true });
  const original = readFileSync(
    resolve(root, "benchmarks/fixtures", engine === "tailwind" ? "tailwind" : "truss", "app/ui.ts"),
    "utf8",
  );
  if (axis === "styles") {
    writeFileSync(resolve(dir, "app/ui.ts"), original + (count ? '\nexport { scaleStyles } from "./__scale";\n' : ""));
    if (count) writeFileSync(resolve(dir, "app/__scale.ts"), distinctStyles(engine, count));
    return;
  }
  writeFileSync(
    resolve(dir, "app/ui.ts"),
    original + (count && process.env.ORPHANED !== "1" ? '\nexport { devScale } from "./__devscale";\n' : ""),
  );
  if (!count) return;
  mkdirSync(generated);
  for (let i = 0; i < count; i++) {
    const code =
      engine === "tailwind"
        ? `export const m${i} = "pt-17 pb-19 mt-23 tracking-[0.037em]";\n`
        : `import { Css } from "~/Css";\nexport const m${i} = Css.ptPx(17).pbPx(19).mtPx(23).add("letterSpacing", "0.037em").$;\n`;
    writeFileSync(resolve(generated, `m${i}.ts`), code);
  }
  writeFileSync(
    resolve(generated, "index.ts"),
    Array.from({ length: count }, (_, i) => `import { m${i} } from "./m${i}";`).join("\n") +
      `\nexport const devScale = [${Array.from({ length: count }, (_, i) => `m${i}`).join(",")}];\n`,
  );
}

/** Match arena cold-build cache removal; this is not an OS page-cache flush. */
function clean(dir) {
  for (const name of ["build", ".react-router", "node_modules/.vite"])
    rmSync(resolve(dir, name), { recursive: true, force: true });
}

/** Time a fresh process through a validated SSR response, with a cold Vite cache. */
async function startOnce(dir, port) {
  await requireFreePort(port);
  rmSync(resolve(dir, "node_modules/.vite"), { recursive: true, force: true });
  const start = performance.now();
  const child = startProcess("npm", ["run", "dev", "--", "--port", String(port), "--strictPort"], {
    cwd: dir,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (data) => {
    output += data;
  });
  child.stderr.on("data", (data) => {
    output += data;
  });
  try {
    while (performance.now() - start < 60000) {
      if (child.exitCode !== null) throw new Error(output);
      try {
        const response = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(20000) });
        if (response.ok && (await response.text()).includes("Recent activity")) return performance.now() - start;
      } catch {}
      await new Promise((done) => setTimeout(done, 20));
    }
    throw new Error(`Dev startup timed out:\n${output}`);
  } finally {
    await stopProcess(child);
  }
}

/** Audit that repeated-file scaling does not accidentally increase style volume. */
function cssSize(dir) {
  const css = Buffer.concat(
    readdirSync(dir)
      .filter((name) => name.endsWith(".css"))
      .sort()
      .map((name) => readFileSync(resolve(dir, name))),
  );
  return { raw: css.length, gzip: gzipSync(css, { level: 9 }).length, brotli: brotliCompressSync(css).length };
}

/** Report the middle sample, averaging the middle pair for even sample counts. */
function median(values) {
  const sorted = values.filter((value) => value !== undefined).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length ? (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2 : null;
}

/** Wrap real plugin hooks to find expensive modules without changing the normal benchmark path. */
function profileConfig(code) {
  return (
    code.replace('trussPlugin({ mapping: "./app/Css.json" })', 'measure(trussPlugin({ mapping: "./app/Css.json" }))') +
    `
import { writeFileSync } from "node:fs";
function measure(plugin) {
  const samples = [];
  const transform = plugin.transform;
  plugin.transform = function(code, id) {
    const start = performance.now();
    const result = transform.call(this, code, id);
    samples.push({ id, bytes: code.length, ms: performance.now() - start, changed: Boolean(result) });
    return result;
  };
  process.on("exit", () => writeFileSync("profile-" + Math.random().toString(36).slice(2) + ".json", JSON.stringify(samples, null, 2)));
  return plugin;
}
`
  );
}

/** Match arena scale.mjs's six declarations and modulo ranges exactly. */
function distinctStyles(engine, count) {
  const styles = Array.from({ length: count }, (_, i) =>
    engine === "tailwind"
      ? `"pt-${100 + i} pb-${200 + i} mt-${300 + i} border-t-${(i % 900) + 1000} text-[${(i % 700) + 2000}px] tracking-[${(i % 500) + 3000}px]"`
      : `Css.ptPx(${100 + i}).pbPx(${200 + i}).mtPx(${300 + i}).add("borderTopWidth", "${(i % 900) + 1000}px").fsPx(${(i % 700) + 2000}).add("letterSpacing", "${(i % 500) + 3000}px").$`,
  );
  return (
    (engine === "tailwind" ? "" : 'import { Css } from "~/Css";\n') +
    `export const scaleStyles = [\n${styles.join(",\n")}\n];\n`
  );
}

/** Record resolved tool versions, rather than semver ranges in the app's package.json. */
function versions(dir) {
  return Object.fromEntries(
    ["vite", "@react-router/dev", "react", "@homebound/truss", "tailwindcss"].flatMap((name) => {
      const file = resolve(dir, "node_modules", name, "package.json");
      return existsSync(file) ? [[name, JSON.parse(readFileSync(file, "utf8")).version]] : [];
    }),
  );
}
