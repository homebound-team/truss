import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import stylex from "@stylexjs/unplugin";
import { trussPlugin } from "../stylex/src/index.ts";

// Compile-in-app setup:
// Add libraries that ship untransformed `Css.*.$` usage.
// Keep this list identical in both Truss and StyleX plugin configs.
const externalPackages: string[] = [
  // "@company/library",
];

// Truss uses one explicit mapping file for all transforms.
// For this sample app we use local generated mapping:
const mapping = "./src/Css.json";
// For a pure "library Css" app, point at the library mapping instead:
// const mapping = "./node_modules/@company/library/dist/Css.json";

export default defineConfig({
  plugins: [
    // Must run before stylex.vite so `Css.*.$` is rewritten first.
    trussPlugin({ mapping, externalPackages }),
    stylex.vite({
      dev: true,
      useCSSLayers: false,
      // If your StyleX unplugin version supports it, pass the same list:
      // externalPackages,
    }),
    react(),
  ],
});
