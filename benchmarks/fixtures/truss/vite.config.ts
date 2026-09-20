import { trussPlugin } from "@homebound/truss/plugin";
import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";


// Truss's Vite plugin is the compiler: it rewrites every `Css.*.$` chain to a
// style hash of literal class names, folds a fully static `css=` prop to a
// plain `className`, and emits the atomic rules the chains produced.
export default defineConfig({
  // CSS minification is disabled across every app in the arena. Vite's default
  // runs Lightning CSS over the emitted stylesheet, which rewrites it — most
  // visibly by downlevelling `light-dark()` into a 54-variable polyfill under
  // the default `baseline-widely-available` target. That measures the
  // downleveller, not the engine, and it only affects engines that emit modern
  // CSS. Disabling it means each stylesheet is exactly what its engine wrote.
  build: { cssMinify: false },
  plugins: [trussPlugin({ mapping: "./app/Css.json" }), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
});
