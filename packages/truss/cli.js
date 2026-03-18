#!/usr/bin/env node

import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { register } from "ts-node";
import { generate } from "./build/index.js";

const require = createRequire(import.meta.url);

// Hook up ts-node so we can require a TypeScript file.
// Pass `module: commonjs` to handle vite projects that use `module: esnext`.
register({ transpileOnly: true, compilerOptions: { module: "commonjs" } });

const filename = process.argv[2] ?? "./truss-config.ts";
const configPath = join(process.cwd(), filename);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const config = await loadConfig(configPath);
  await generate(config);
  console.log(`Generated ${config.outputPath}`);
}

async function loadConfig(configPath) {
  try {
    return require(configPath).default;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ERR_REQUIRE_ESM") {
      return (await import(pathToFileURL(configPath).href)).default;
    }
    throw err;
  }
}
