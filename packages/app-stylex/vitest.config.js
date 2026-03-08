import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import stylex from "@stylexjs/unplugin";

export default defineConfig({
  plugins: [
    stylex.vite({ dev: true, runtimeInjection: true, useCSSLayers: false }),
    react({ jsxImportSource: "@homebound/truss-stylex" }),
  ],
  test: {
    environment: "jsdom",
  },
});
