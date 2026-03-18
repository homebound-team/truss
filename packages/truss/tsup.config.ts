import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "plugin/index": "src/plugin/index.ts",
  },
  format: ["esm"],
  dts: true,
  splitting: false,
  sourcemap: true,
  outDir: "build",
  clean: true,
  target: "es2022",
  platform: "node",
  bundle: true,
  skipNodeModulesBundle: true,
});
