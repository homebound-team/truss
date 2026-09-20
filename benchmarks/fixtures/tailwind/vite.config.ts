import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Tailwind's Vite plugin is the compiler: it scans every source file for class
// names and emits only the utility rules those names ask for, resolving them
// against the `@theme` block in app/app.css.
export default defineConfig({
  // CSS minification is disabled across every app in the arena. Vite's default
  // runs Lightning CSS over the emitted stylesheet, which rewrites it — most
  // visibly by downlevelling `light-dark()` into a 54-variable polyfill under
  // the default `baseline-widely-available` target. That measures the
  // downleveller, not the engine, and it only affects engines that emit modern
  // CSS. Disabling it means each stylesheet is exactly what its engine wrote.
  //
  // Tailwind runs Lightning CSS itself, inside the plugin, for its own
  // optimisation pass. That is part of its product and stays.
  build: { cssMinify: false },
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
