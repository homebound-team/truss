module.exports = {
  // Disable CI environment detection so that semantic-release doesn't skip publishing
  // when an open PR exists targeting the current branch (e.g. feat/v2 <- main), which
  // causes CircleCI to set CIRCLE_PULL_REQUEST on every build for that branch.
  ci: false,
  branches: ["main", { name: "feat/v2", range: "2.x", channel: "next" }],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
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
