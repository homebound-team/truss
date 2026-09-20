import { readFileSync } from "node:fs";

const profile = JSON.parse(readFileSync(process.argv[2], "utf8"));
const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
const times = new Map();
for (let i = 0; i < profile.samples.length; i++) {
  const frame = nodes.get(profile.samples[i]).callFrame;
  const name = `${frame.functionName} ${frame.url}:${frame.lineNumber + 1}`;
  times.set(name, (times.get(name) ?? 0) + profile.timeDeltas[i] / 1000);
}
console.log(
  [...times]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 60)
    .map(([name, ms]) => `${ms.toFixed(1)}ms ${name}`)
    .join("\n"),
);
