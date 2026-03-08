import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Import stylex runtime for dev HMR
import("virtual:stylex:runtime").catch(() => {
  // Ignore in test environments where virtual modules aren't available
});
