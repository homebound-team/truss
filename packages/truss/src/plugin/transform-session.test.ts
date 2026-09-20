import { afterEach, describe, expect, test } from "vitest";
import { resolve } from "path";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { createTrussTransformSession } from "./transform-session";

const temporaryDirectories: string[] = [];

describe("transform-session", () => {
  afterEach(() => {
    for (const directory of temporaryDirectories) rmSync(directory, { recursive: true, force: true });
    temporaryDirectories.length = 0;
  });

  test("a new build restores cached rules only for modules it reaches", () => {
    // Given a build with two independently styled modules
    const session = createSession();
    const source = 'import { Css } from "./Css"; export const a = Css.df.$;';
    session.transformCode(source, "a.ts");
    session.transformCode('import { Css } from "./Css"; export const b = Css.db.$;', "b.ts");
    session.collectCss(false);

    // When the next build reaches only the unchanged first module
    session.reset();
    session.transformCode(source, "a.ts");

    // Then cached transformations repopulate the new registry without retaining unreachable CSS
    expect(session.collectCss(false)).toBe(
      ':root { --t-spacing: 8px; }\n.df { display: flex; }\n@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }',
    );
  });

  test("editing a cached module transforms the new source", () => {
    // Given a cached transform
    const session = createSession();
    session.transformCode('import { Css } from "./Css"; const s = Css.df.$;', "a.ts");

    // When the same module changes its declaration
    const result = session.transformCode('import { Css } from "./Css"; const s = Css.db.$;', "a.ts");

    // Then the returned JavaScript carries the new class
    expect(result?.code).toBe('const s = {\n  display: "db"\n};');
  });

  test("debug and production transforms do not share a cached result", () => {
    // Given a debug transform for this module
    const session = createSession();
    const source = 'import { Css } from "./Css"; const s = Css.df.$;';
    session.transformCode(source, "a.ts", { debug: true });

    // When the same source is requested for production
    const result = session.transformCode(source, "a.ts", { debug: false });

    // Then no debug constructor or import leaks into production
    expect(result?.code).toBe('const s = {\n  display: "df"\n};');
  });

  test("cached arbitrary CSS is restored after a build reset", () => {
    // Given a compiled arbitrary stylesheet
    const session = createSession();
    const source = 'export const css = { body: "margin: 0;" };';
    session.updateArbitraryCssRegistry("a.css.ts", source);
    session.collectCss(false);

    // When an unchanged stylesheet is loaded in the next build
    session.reset();
    session.updateArbitraryCssRegistry("a.css.ts", source);

    // Then the new registry emits the cached stylesheet
    expect(session.collectCss(false)).toBe(
      ':root { --t-spacing: 8px; }\n@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }\nbody {\n  margin: 0;\n}',
    );
  });

  test("removing arbitrary CSS invalidates the collected stylesheet", () => {
    // Given an already collected stylesheet
    const session = createSession();
    session.updateArbitraryCssRegistry("a.css.ts", 'export const css = { body: "margin: 0;" };');
    session.collectCss(false);

    // When the file no longer contributes rules
    session.updateArbitraryCssRegistry("a.css.ts", "export const css = {};");

    // Then a subsequent request cannot serve stale CSS
    expect(session.collectCss(false)).toBe(
      ':root { --t-spacing: 8px; }\n@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }',
    );
  });

  test("new atomic rules invalidate a collected stylesheet", () => {
    // Given a stylesheet collected before any style module was loaded
    const session = createSession();
    session.collectCss(false);

    // When a module introduces a rule
    session.transformCode('import { Css } from "./Css"; const s = Css.df.$;', "a.ts");

    // Then the stylesheet request includes that rule
    expect(session.collectCss(false)).toBe(
      ':root { --t-spacing: 8px; }\n.df { display: flex; }\n@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }',
    );
  });

  test("repeated invalid modules report diagnostics in each environment", () => {
    // Given an invalid module requested by two build environments
    const session = createSession();
    const errors: string[] = [];
    const options = { onDiagnostic: (error: Error) => errors.push(error.message) };
    const source = 'import { Css } from "./Css"; const s = Css.notATrussToken.$;';

    // When both environments transform it
    session.transformCode(source, "a.ts", options);
    session.transformCode(source, "a.ts", options);

    // Then the first environment's result does not suppress the second diagnostic
    expect(errors).toHaveLength(2);
  });

  test("a cached transform notices a new css.ts companion for a bare CSS import", () => {
    // Given a compiled module whose stylesheet was ordinary CSS
    const directory = createTemporaryDirectory();
    const session = createSession();
    const source = 'import "./theme.css"; import { Css } from "./Css"; const s = Css.df.$;';
    writeFileSync(resolve(directory, "theme.css"), "body { margin: 0; }");
    session.transformCode(source, resolve(directory, "a.ts"), { rewriteCssImports: true });

    // When the unchanged import gains a build-time stylesheet companion
    writeFileSync(resolve(directory, "theme.css.ts"), "export const css = {};");
    const result = session.transformCode(source, resolve(directory, "a.ts"), { rewriteCssImports: true });

    // Then the transform rechecks resolution rather than replaying its stale import
    expect(result?.code).toBe('import "./theme.css.ts?truss-css";\nconst s = {\n  display: "df"\n};');
  });

  test("a former no-op can rewrite a new stylesheet without removing a re-exported Css binding", () => {
    // Given a module with no DSL expressions and an ordinary stylesheet import
    const directory = createTemporaryDirectory();
    const session = createSession();
    const source = 'import { Css } from "./Css"; import "./theme.css"; export { Css };';
    writeFileSync(resolve(directory, "theme.css"), "body { margin: 0; }");
    session.transformCode(source, resolve(directory, "a.ts"), { rewriteCssImports: true });

    // When a build-time stylesheet makes the unchanged module need an import-only rewrite
    writeFileSync(resolve(directory, "theme.css.ts"), "export const css = {};");
    const result = session.transformCode(source, resolve(directory, "a.ts"), { rewriteCssImports: true });

    // Then the import is updated while the non-DSL use of Css stays valid
    expect(result?.code).toBe('import { Css } from "./Css";\nimport "./theme.css.ts?truss-css";\nexport { Css };');
  });

  test("a cached no-op does not suppress a later test bootstrap for the same source", () => {
    // Given a plain application file previously requested without test bootstrapping
    const session = createSession();
    const source = "export const value = 1;";
    session.transformCode(source, "a.ts");

    // When the same file is loaded by a test environment
    const result = session.transformCode(source, "a.ts", { bootstrapImport: "virtual:truss:test-css" });

    // Then the test environment receives its bootstrap import
    expect(result?.code).toBe('export const value = 1;\nimport "virtual:truss:test-css";');
  });

  test("cached css.ts module transforms restore selector-based CSS after a build reset", () => {
    // Given selector-based CSS extracted by the shared module transformation flow
    const session = createSession();
    const source = 'export const css = { body: "margin: 0;" }; export const className = "body";';
    session.transformCode(source, "a.css.ts", { rewriteCssImports: true });
    session.collectCss(false);

    // When the next build reaches the unchanged stylesheet module
    session.reset();
    session.transformCode(source, "a.css.ts", { rewriteCssImports: true });

    // Then replaying the cached module also restores its stylesheet to the new registry
    expect(session.collectCss(false)).toBe(
      ':root { --t-spacing: 8px; }\n@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }\nbody {\n  margin: 0;\n}',
    );
  });

  test("a mapped request does not reuse a cached transform without maps", () => {
    // Given a production transform that did not need a source map
    const session = createSession();
    const source = 'import { Css } from "./Css"; const s = Css.df.$;';
    session.transformCode(source, "a.ts", { sourceMaps: false });

    // When a caller requests the same source with the default map policy
    const result = session.transformCode(source, "a.ts");

    // Then it receives a map for the original source rather than the mapless cached result
    expect(result?.map).toMatchObject({ sources: ["a.ts"] });
  });

  test("a mapless request does not reuse a cached mapped transform", () => {
    // Given a transform with a source map
    const session = createSession();
    const source = 'import { Css } from "./Css"; const s = Css.df.$;';
    session.transformCode(source, "a.ts");

    // When a build requests the same source without source maps
    const result = session.transformCode(source, "a.ts", { sourceMaps: false });

    // Then the mapped cache entry does not leak into the mapless mode
    expect(result?.map).toBeNull();
  });
});

/** Use the same generated mapping as the transform regression suite. */
function createSession() {
  return createTrussTransformSession({
    mappingPath: () => resolve(__dirname, "../../../app/src/Css.json"),
    projectRoot: () => resolve(__dirname),
  });
}

/** Own each test's stylesheet files so filesystem-dependent cache checks stay isolated. */
function createTemporaryDirectory() {
  const directory = mkdtempSync(resolve(tmpdir(), "truss-transform-session-"));
  temporaryDirectories.push(directory);
  return directory;
}
