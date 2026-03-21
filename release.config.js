module.exports = {
  branches: ["main"],
  plugins: [
    // Use conventionalcommits preset (not the default angular) so that
    // `feat!:` / `fix!:` commits are recognized as breaking changes.
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    "@semantic-release/changelog",
    [
      "@semantic-release/exec",
      {
        prepareCmd:
          'ROOT=$(pwd) && yarn workspaces foreach -v --all exec node "$ROOT/scripts/set-package-versions.js" ${nextRelease.version}',
        publishCmd: "yarn workspaces foreach -v --all --no-private npm publish --tolerate-republish",
      },
    ],
    "@semantic-release/github",
    ["@semantic-release/git", { assets: ["CHANGELOG.md", "package.json", "packages/*/package.json"] }],
  ],
};
