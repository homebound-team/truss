import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import stylex from "@stylexjs/unplugin";

export default defineConfig({
  plugins: [stylex.vite({ dev: true, useCSSLayers: false }), react({ jsxImportSource: "@homebound/truss-stylex" })],
});
