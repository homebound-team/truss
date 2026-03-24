import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import { trussPlugin } from "@homebound/truss/plugin";

export default defineConfig({
  plugins: [trussPlugin({ mapping: "./src/Css.json" }), react()],
  test: {
    environment: "jsdom",
  },
});
