import stylex from "@stylexjs/unplugin";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vitest/config";
import { trussPlugin } from "../stylex/src/index.ts";

export default defineConfig({
  plugins: [
    trussPlugin({ mapping: "./src/Css.json" }),
    stripConfigureServer(stylex.vite({ dev: true, runtimeInjection: true, useCSSLayers: false })),
    react(),
  ],
  test: {
    environment: "jsdom",
  },
});

/**
 * Strip the `configureServer` hook from a Vite plugin.
 *
 * The StyleX unplugin registers a `setInterval` inside `configureServer` that
 * only clears when the HTTP server emits "close".  Vitest never starts a real
 * HTTP server, so the interval keeps the process alive and causes a
 * "close timed out" warning.  Removing the hook is safe for tests because the
 * dev-server middleware it installs is irrelevant during `vitest run`.
 */
function stripConfigureServer(plugin) {
  if (Array.isArray(plugin)) return plugin.map(stripConfigureServer);
  if (plugin && typeof plugin === "object" && "configureServer" in plugin) {
    const { configureServer, ...rest } = plugin;
    return rest;
  }
  return plugin;
}
