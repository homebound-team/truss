import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Transform tests call transformTruss() directly — no vite plugins needed.
    // They load the mapping file via loadMapping(), not through the plugin.
    include: ["src/**/*.test.ts"],
  },
});
