module.exports = {
  // Disable CI environment detection so that semantic-release doesn't skip publishing
  // when an open PR exists targeting the current branch (e.g. feat/v2 <- main), which
  // causes CircleCI to set CIRCLE_PULL_REQUEST on every build for that branch.
  ci: false,
  branches: ["main", { name: "feat/v2", prerelease: "next", channel: "next" }],
  plugins: [
    // Use conventionalcommits preset (not the default angular) so that
    // `feat!:` / `fix!:` commits are recognized as breaking changes.
    ["@semantic-release/commit-analyzer", { preset: "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { preset: "conventionalcommits" }],
    "@semantic-release/changelog",
    [
      "@semantic-release/exec",
      {
        prepareCmd: "yarn workspaces foreach -v --all version ${nextRelease.version}",
        publishCmd: "yarn workspaces foreach -v --all --no-private npm publish --tolerate-republish",
      },
    ],
    "@semantic-release/github",
    ["@semantic-release/git", { assets: ["CHANGELOG.md", "package.json", "packages/*/package.json"] }],
  ],
};
