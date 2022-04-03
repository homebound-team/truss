module.exports = {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    ["@semantic-release/npm", { npmPublish: false, pkgRoot: "." }],
    ["@semantic-release/npm", { npmPublish: false, pkgRoot: "packages/truss" }],
    ["@semantic-release/npm", { npmPublish: false, pkgRoot: "packages/testing-tachyons" }],
    ["@semantic-release/npm", { npmPublish: false, pkgRoot: "packages/testing-tachyons-emotion" }],
    ["@semantic-release/npm", { npmPublish: false, pkgRoot: "packages/testing-tachyons-fela" }],
    ["@semantic-release/npm", { npmPublish: false, pkgRoot: "packages/testing-tachyons-mui" }],
    ["@semantic-release/exec", { publishCmd: "yarn npm publish", execCwd: "packages/truss" }],
    "@semantic-release/github",
    ["@semantic-release/git", { assets: ["CHANGELOG.md", "package.json", "packages/*/package.json"] }],
  ],
};
