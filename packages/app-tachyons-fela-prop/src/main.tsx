import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

// Create a MutationObserver
const observer = new MutationObserver((mutationsList) => {
  for (const mutation of mutationsList) {
    // Check added nodes for stylesheets
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node: any) => {
        if (
          (node.nodeType === Node.ELEMENT_NODE && node.tagName === "LINK" && node.rel === "stylesheet") ||
          node.tagName === "STYLE"
        ) {
          console.log("New stylesheet added:", node);
        }
      });
    }
  }
});
// Observer configuration
const config = { childList: true, subtree: true };
// Start observing the <head> and <body> for new stylesheets
observer.observe(document.head, config);
observer.observe(document.body, config);

// Stop observing if needed with: observer.disconnect();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
