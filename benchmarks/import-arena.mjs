import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const source = resolve(process.argv[2] ?? "/home/stephen/other/css-in-js-arena");
const destination = new URL("./fixtures/", import.meta.url);
mkdirSync(destination, { recursive: true });
for (const engine of ["truss", "tailwind"]) {
  const target = new URL(`${engine}/`, destination);
  if (existsSync(target)) throw new Error(`Fixture already exists: ${target.pathname}`);
  mkdirSync(target);
  for (const name of [
    "app",
    "public",
    "package.json",
    "package-lock.json",
    "vite.config.ts",
    "tsconfig.json",
    "react-router.config.ts",
  ]) {
    cpSync(resolve(source, "apps", engine, name), new URL(name, target), { recursive: true });
  }
}
const revision = execFileSync("git", ["rev-parse", "HEAD"], { cwd: source, encoding: "utf8" }).trim();
writeFileSync(
  new URL("provenance.json", destination),
  JSON.stringify(
    {
      source: "css-in-js-arena",
      revision,
      importedAt: new Date().toISOString(),
      description:
        "Six-page React Router fixtures; source copied from the working tree. Css outputs are pre-generated, as in the arena.",
    },
    null,
    2,
  ) + "\n",
);
for (const name of ["README.md", "RUNNING.md"]) {
  writeFileSync(new URL(`arena-${name}`, destination), readFileSync(resolve(source, name)));
}
