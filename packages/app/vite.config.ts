import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { trussPlugin } from "@homebound/truss/plugin";

// Pre-compiled library setup:
// Add paths to truss.css files from libraries that ship pre-compiled CSS.
// const libraries = ["./node_modules/@company/library/dist/truss.css"];

// Truss uses one explicit mapping file for all transforms.
// For this sample app we use local generated mapping:
const mapping = "./src/Css.json";

export default defineConfig({
  plugins: [trussPlugin({ mapping }), react()],
});
