#!/usr/bin/env node

// Hook up ts-node so we can require a TypeScript file
const { register } = require("ts-node");
// Pass `module: commonjs` to handle vite projects that use `module: esnext`
register({ transpileOnly: true, compilerOptions: { module: "commonjs" } });

// Maybe get the custom filename (or path to filename)
const filename = process.argv[2] ?? "./truss-config.ts";
// Get the config from the root project directory
const configPath = require("path").join(process.cwd(), filename);

// Use dynamic import() to support both CJS and ESM packages
async function main() {
  let config;
  try {
    config = require(configPath).default;
  } catch (err) {
    if (err.code === "ERR_REQUIRE_ESM") {
      config = (await import(configPath)).default;
    } else {
      throw err;
    }
  }

  const { generate } = require("./build/index.js");
  await generate(config);
  console.log(`Generated ${config.outputPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
