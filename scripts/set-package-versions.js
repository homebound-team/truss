const fs = require("node:fs");
const path = require("node:path");

/**
 * Updates the current workspace package.json version.
 *
 * We do this directly instead of `yarn version` because we observed Yarn ignore
 * the explicit semantic-release version we passed in and derive its own
 * prerelease version, which produced invalid release commits/tags.
 *
 * See https://github.com/homebound-team/truss/commit/d65af1afed1dd55b4517212a4e6f6d8bd76146b2
 * for one example where semantic-release computed `2.0.0-next.14`, but the
 * committed package.json versions were rewritten to `1.137.6-0`.
 */
function main() {
  const version = process.argv[2];

  if (!version) {
    throw new Error("Expected version argument");
  }

  const packageJsonPath = path.join(process.cwd(), "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));

  packageJson.version = version;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

main();
