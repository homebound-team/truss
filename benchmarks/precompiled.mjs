import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Produce a diagnostic lower-bound control by compiling fixture styles outside the timer.
 * This is not a competing engine: it omits compiler initialization, transforms, and dev debug data.
 */
export async function precompile(dir) {
  const { trussPlugin } = await import(
    pathToFileURL(resolve(dir, "node_modules/@homebound/truss/build/plugin/index.js"))
  );
  const plugin = trussPlugin({ mapping: "./app/Css.json" });
  plugin.configResolved({ root: dir, command: "build", mode: "production", build: {} });
  plugin.buildStart();
  const context = {
    warn(message) {
      throw new Error(String(message));
    },
  };
  for (const name of readdirSync(resolve(dir, "app"), { recursive: true })) {
    if (!/\.tsx?$/.test(name) || name === "Css.ts" || name.endsWith(".d.ts")) continue;
    if (process.env.ORPHANED === "1" && name.startsWith("__devscale/")) continue;
    const file = resolve(dir, "app", name);
    const original = readFileSync(file, "utf8");
    const transformed = plugin.transform.call(context, original, file);
    if (name.endsWith(".css.ts")) {
      writeFileSync(file, "export {};\n");
    } else {
      writeFileSync(
        file,
        (transformed?.code ?? original)
          .replace(/import\s*["'][^"']+\?truss-css["'];?/g, "")
          .replace('"virtual:truss.css"', '"./precompiled.css"'),
      );
    }
  }
  const id = plugin.resolveId("virtual:truss.css");
  const asset = { type: "asset", fileName: "precompiled.css", source: plugin.load.call(context, id) };
  plugin.generateBundle.handler.call(context, {}, { "precompiled.css": asset });
  writeFileSync(resolve(dir, "app/precompiled.css"), asset.source);
  const config = readFileSync(resolve(dir, "vite.config.ts"), "utf8")
    .replace('import { trussPlugin } from "@homebound/truss/plugin";', "")
    .replace('trussPlugin({ mapping: "./app/Css.json" }), ', "");
  writeFileSync(resolve(dir, "benchmark.config.ts"), config);
}
