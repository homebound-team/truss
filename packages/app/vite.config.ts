import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { trussPlugin } from "@homebound/truss/plugin";

// Compile-in-app setup:
// Add libraries that ship untransformed `Css.*.$` usage.
const externalPackages: string[] = [
  // "@company/library",
];

// Truss uses one explicit mapping file for all transforms.
// For this sample app we use local generated mapping:
const mapping = "./src/Css.json";

export default defineConfig({
  plugins: [trussPlugin({ mapping, externalPackages }), react()],
});
