import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const save = args.indexOf("--save");
const destination = save < 0 ? undefined : args.splice(save, 2)[1];
const reports = args.map((path) => ({ source: path, data: JSON.parse(readFileSync(path, "utf8")) }));
for (const report of reports) {
  console.log(report.source);
  const data = report.data;
  if (data.baselineJs) {
    console.log(data);
    continue;
  }
  if (Array.isArray(data)) {
    console.log(
      `${data.length} screenshot comparisons; ${data.reduce((sum, row) => sum + row.materialDifferences, 0)} material pixel differences`,
    );
    continue;
  }
  if (data.categories || data.samples) {
    console.table(data.categories ?? data.samples);
    continue;
  }
  const rows = data.results ?? data.rows;
  const groups = Map.groupBy(rows, (row) => `${row.engine}/${row.count ?? row.kind}`);
  const summary = [];
  for (const [group, samples] of groups) {
    const entry = { group, samples: samples.length };
    for (const key of data.results ? ["cold", "warm", "start"] : ["correct", "cssLive", "browserUpdate", "bytes"]) {
      const values = samples.map((row) => row[key]).filter((value) => typeof value === "number");
      if (values.length)
        entry[key] =
          `${median(values).toFixed(2)} [${Math.min(...values).toFixed(2)}, ${Math.max(...values).toFixed(2)}]`;
    }
    summary.push(entry);
  }
  console.table(summary);
}
if (destination) {
  const file = resolve(destination);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify(
      {
        description:
          "Raw samples. Truss package version fields describe the installed dependency shell; baseline/candidate compiled artifacts were overlaid into it. See RESULTS.md for revision and methodology.",
        reports,
      },
      null,
      2,
    ) + "\n",
  );
}

/** Use the same median definition for builds, startup, and browser samples. */
function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return (sorted[Math.floor(sorted.length / 2)] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2;
}
