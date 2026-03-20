#!/usr/bin/env node

import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { register } from "tsx/esm/api";
import { generate } from "./build/index.js";

// Register tsx loader so we can import TypeScript config files
// (handles both CJS and ESM projects, with extensionless .ts imports).
const unregister = register();

const filename = process.argv[2] ?? "./truss-config.ts";
const configPath = join(process.cwd(), filename);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const config = (await import(pathToFileURL(configPath).href)).default;
  unregister();
  await generate(config);
  console.log(`Generated ${config.outputPath}`);
}
