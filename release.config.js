module.exports = {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    [
      "@semantic-release/exec",
      { prepareCmd: "yarn workspaces foreach exec npm version --no-git-tag-version ${nextRelease.version}" },
    ],
    ["@semantic-release/exec", { publishCmd: "yarn npm publish", execCwd: "packages/truss" }],
    ["@semantic-release/exec", { publishCmd: "yarn npm publish", execCwd: "packages/fast-css-prop" }],
    "@semantic-release/github",
    ["@semantic-release/git", { assets: ["CHANGELOG.md", "package.json", "packages/*/package.json"] }],
  ],
};
