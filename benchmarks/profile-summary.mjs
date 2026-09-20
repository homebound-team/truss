import { readFileSync, writeFileSync } from "node:fs";

const profile = JSON.parse(readFileSync(process.argv[2], "utf8"));
const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
const times = new Map();
const categories = new Map();
for (let i = 0; i < profile.samples.length; i++) {
  const frame = nodes.get(profile.samples[i]).callFrame;
  const name = `${frame.functionName} ${frame.url}:${frame.lineNumber + 1}`;
  times.set(name, (times.get(name) ?? 0) + profile.timeDeltas[i] / 1000);
  const category = categoryFor(frame);
  categories.set(category, (categories.get(category) ?? 0) + profile.timeDeltas[i] / 1000);
}
console.log("Self time by category (sampling attribution, not wall-clock phase timings):");
console.log(
  [...categories]
    .sort((a, b) => b[1] - a[1])
    .map(([name, ms]) => `${ms.toFixed(1)}ms ${name}`)
    .join("\n"),
);
console.log("\nTop self-time frames:");
console.log(
  [...times]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([name, ms]) => `${ms.toFixed(1)}ms ${name}`)
    .join("\n"),
);
if (process.argv[3]) {
  writeFileSync(
    process.argv[3],
    JSON.stringify(
      {
        source: process.argv[2],
        samples: profile.samples.length,
        categories: Object.fromEntries(categories),
        frames: [...times].sort((a, b) => b[1] - a[1]),
      },
      null,
      2,
    ) + "\n",
  );
}

/** Attribute only the executing frame; inclusive stacks would double-count shared work. */
function categoryFor(frame) {
  const url = frame.url;
  if (frame.functionName === "(garbage collector)") return "GC";
  if (url.startsWith("node:inspector")) return "Profiler overhead";
  if (url.includes("@babel/parser")) return "Babel parser";
  if (url.includes("@babel/traverse")) return "Babel traversal/scope";
  if (url.includes("@babel/generator")) return "Babel generator";
  if (url.includes("@babel/types")) return "Babel types";
  if (url.includes("@jridgewell/")) return "Source maps";
  if (url.includes("/plugin/index.js")) return "Truss (bundled)";
  if (url.startsWith("node:")) return "Node/loading";
  return "Other";
}
