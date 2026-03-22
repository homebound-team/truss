#!/usr/bin/env node

import { createJiti } from "jiti";
import { join } from "path";

const filename = process.argv[2] ?? "./truss-config.ts";
const configPath = join(process.cwd(), filename);
const jiti = createJiti(import.meta.url, { interopDefault: true });

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

async function main() {
  const config = await jiti.import(configPath, { default: true });
  const { generate } = await import("./build/index.js");
  await generate(config);
  console.log(`Generated ${config.outputPath}`);
}
