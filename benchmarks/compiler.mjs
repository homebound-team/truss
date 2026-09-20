import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";

const root = new URL("../", import.meta.url).pathname;
const start = performance.now();
const { trussPlugin } = await import(new URL("../packages/truss/build/plugin/index.js", import.meta.url));
console.log("plugin import ms", performance.now() - start);
const app = resolve(root, "benchmarks/fixtures/truss");
const plugin = trussPlugin({ mapping: resolve(app, "app/Css.json") });
plugin.configResolved({ root: app, command: "build", build: {} });
const mappingStart = performance.now();
plugin.buildStart();
console.log("mapping ms", performance.now() - mappingStart);
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
for (let pass = 0; pass < 3; pass++) {
  const timings = [];
  for (const source of sources) {
    const start = performance.now();
    plugin.transform.call(context, source.code, source.file);
    timings.push({ file: source.file.slice(app.length), ms: performance.now() - start });
  }
  console.log(
    "pass",
    pass,
    timings.sort((a, b) => b.ms - a.ms),
  );
}
const repeatedStart = performance.now();
for (let i = 0; i < 1600; i++) {
  plugin.transform.call(
    context,
    `import { Css } from "~/Css";\nexport const m${i} = Css.ptPx(17).pbPx(19).mtPx(23).add("letterSpacing", "0.037em").$;`,
    resolve(app, `app/generated${i}.ts`),
  );
}
console.log("1600 distinct modules ms", performance.now() - repeatedStart);
