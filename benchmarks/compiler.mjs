import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { Session } from "node:inspector/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url).pathname;
const build = resolve(root, process.env.COMPILER_BUILD ?? "packages/truss/build");
const profileDir = process.env.PROFILE_DIR && resolve(root, process.env.PROFILE_DIR);
const inspector = profileDir ? new Session() : undefined;
if (inspector) {
  mkdirSync(profileDir, { recursive: true });
  inspector.connect();
  await inspector.post("Profiler.enable");
  await inspector.post("Profiler.setSamplingInterval", { interval: 100 });
}
const report = {
  node: process.version,
  build,
  compilerHash: createHash("sha256")
    .update(readFileSync(resolve(build, "plugin/index.js")))
    .digest("hex"),
  mode: process.env.MODE ?? "build",
  buildSourcemap: process.env.SOURCE_MAPS === "1",
  samples: [],
};
let trussPlugin;
await measure("import", async () => {
  ({ trussPlugin } = await import(pathToFileURL(resolve(build, "plugin/index.js"))));
});
const app = resolve(root, "benchmarks/fixtures/truss");
const context = {
  warn(message) {
    throw new Error(String(message));
  },
};
const files = readdirSync(resolve(app, "app"), { recursive: true }).filter(
  (name) => /\.[jt]sx?$/.test(name) && name !== "Css.ts",
);
const sources = files.map((file) => ({
  file: resolve(app, "app", file),
  code: readFileSync(resolve(app, "app", file), "utf8"),
}));
for (let run = 0; run < Number(process.env.RUNS ?? 1); run++) {
  const plugin = trussPlugin({ mapping: resolve(app, "app/Css.json") });
  plugin.configResolved({
    root: app,
    command: process.env.MODE === "dev" ? "serve" : "build",
    build: { sourcemap: process.env.SOURCE_MAPS === "1" },
  });
  await measure(`mapping-${run}`, () => plugin.buildStart());
  for (let pass = 0; pass < 3; pass++) {
    await measure(`fixture-${run}-${pass}`, () => {
      for (const source of sources) plugin.transform.call(context, source.code, source.file);
    });
  }
  await measure(`distinct-${run}`, () => {
    for (let i = 0; i < 1600; i++) {
      plugin.transform.call(
        context,
        `import { Css } from "~/Css";\nexport const m${i} = Css.ptPx(17).pbPx(19).mtPx(23).add("letterSpacing", "0.037em").$;`,
        resolve(app, `app/generated${i}.ts`),
      );
    }
  });
  await measure(`edits-${run}`, () => {
    const source = sources.find((source) => source.file.endsWith("routes/dashboard.tsx"));
    for (let edit = 0; edit < 100; edit++) {
      // Unique source text bypasses the unchanged-module cache, as a component edit does.
      plugin.transform.call(context, source.code + `\n// edit ${edit}`, source.file);
    }
  });
}
inspector?.disconnect();
if (process.env.OUTPUT) writeFileSync(resolve(root, process.env.OUTPUT), JSON.stringify(report, null, 2) + "\n");

/** Profile phases separately so module initialization cannot be mistaken for transform work. */
async function measure(name, action) {
  if (inspector) await inspector.post("Profiler.start");
  const start = performance.now();
  await action();
  const ms = performance.now() - start;
  report.samples.push({ name, ms });
  console.log(name, ms.toFixed(3), "ms");
  if (inspector) {
    const { profile } = await inspector.post("Profiler.stop");
    writeFileSync(resolve(profileDir, `${name}.cpuprofile`), JSON.stringify(profile));
  }
}
