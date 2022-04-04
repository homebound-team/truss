#!/usr/bin/env node

// Hook up ts-node so we can require a TypeScript file
require("ts-node/register/transpile-only");

// Get the config from the root project directory
const configPath = require("path").join(process.cwd(), "./truss-config.ts");
const config = require(configPath).default;

const { generate } = require("./build/index.js");
generate(config)
  .then((done) => {
    console.log(`Generated ${config.outputPath}`);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
