import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import stylex from "@stylexjs/unplugin";
import { trussPlugin } from "../stylex/src/index.ts";

export default defineConfig({
  plugins: [trussPlugin({ mapping: "./src/Css.json" }), stylex.vite({ dev: true, useCSSLayers: false }), react()],
});
