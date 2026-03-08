import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import stylex from "@stylexjs/unplugin";

export default defineConfig({
  plugins: [
    // Use runtimeInjection so compiled styles are injected into <style> tags
    // at runtime, making them visible to jsdom's getComputedStyle / toHaveStyle.
    stylex.vite({ dev: true, runtimeInjection: true, useCSSLayers: false }),
    react({ jsxImportSource: "@homebound/truss-stylex" }),
  ],
  test: {
    environment: "jsdom",
  },
});
