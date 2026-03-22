import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { transformCssTs } from "./transform-css";
import { camelToKebab } from "./emit-truss";
import { loadMapping, trussPlugin } from "./index";
import { resolve } from "path";

const mapping = loadMapping(resolve(__dirname, "../../../app-stylex/src/Css.json"));

describe("transformCssTs", () => {
  test("single selector with static chain", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.df.$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`
        .foo {
          display: flex;
        }
      `),
    );
  });

  test("multiple selectors", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.df.$, ".bar": Css.black.$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`
        .foo {
          display: flex;
        }

        .bar {
          color: #353535;
        }
      `),
    );
  });

  test("multi-getter chain produces multiple declarations", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.df.aic.$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`
        .foo {
          display: flex;
          align-items: center;
        }
      `),
    );
  });

  test("variable with literal arg: Css.mt(2).$", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.mt(2).$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`
        .foo {
          margin-top: 16px;
        }
      `),
    );
  });

  test("variable with string literal: Css.mt('10px').$", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.mt("10px").$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`
        .foo {
          margin-top: 10px;
        }
      `),
    );
  });

  test("typography literal: Css.typography('f14').$", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.typography("f14").$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`
        .foo {
          font-size: 14px;
        }
      `),
    );
  });

  test("delegate with literal: Css.mtPx(12).$", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.mtPx(12).$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`
        .foo {
          margin-top: 12px;
        }
      `),
    );
  });

  test("complex selector strings", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo > .bar:nth-child(2)": Css.df.$, ".a ~ .b::before": Css.black.$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`
        .foo > .bar:nth-child(2) {
          display: flex;
        }

        .a ~ .b::before {
          color: #353535;
        }
      `),
    );
  });

  test("selector template literal can reuse an exported class constant", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const someClassName = "some-class-name"; export const css = { [\`.\${someClassName}\`]: Css.df.$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`
        .some-class-name {
          display: flex;
        }
      `),
    );
  });

  // Error cases — inline comment, selector skipped

  test("error: variable arg produces inline comment", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; const x = 5; export const css = { ".foo": Css.mt(x).$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`/* [truss] unsupported: ".foo" — variable value with variable argument is not supported in .css.ts files */`),
    );
  });

  test("error: typography runtime key produces inline comment", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; const key = "f14"; export const css = { ".foo": Css.typography(key).$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`/* [truss] unsupported: ".foo" — typography() with a runtime key is not supported in .css.ts files */`),
    );
  });

  test("error: if() conditional produces inline comment", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.if(true).df.$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(n(`/* [truss] unsupported: ".foo" — if() conditionals are not supported in .css.ts files */`));
  });

  test("error: onHover modifier produces inline comment", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.onHover.blue.$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(
        `/* [truss] unsupported: ".foo" — pseudo-class modifiers (onHover, onFocus, etc.) are not supported in .css.ts files */`,
      ),
    );
  });

  test("error: ifSm modifier produces inline comment", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.ifSm.blue.$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(
        `/* [truss] unsupported: ".foo" — media query modifiers (ifSm, ifMd, etc.) are not supported in .css.ts files */`,
      ),
    );
  });

  test("error: unknown abbreviation produces inline comment", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": Css.totallyBogus.$ };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`/* [truss] unsupported: ".foo" — [truss] Unsupported pattern: Unknown abbreviation "totallyBogus" */`),
    );
  });

  test("error: non-Css expression value produces inline comment", () => {
    const css = transformCssTs(
      `import { Css } from "./Css"; export const css = { ".foo": "not a Css expression" };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(n(`/* [truss] unsupported: ".foo" — value must be a Css.*.$  expression */`));
  });

  test("error: no Css import produces comment", () => {
    const css = transformCssTs(`export const css = { ".foo": "bar" };`, "test.css.ts", mapping);
    expect(n(css)).toBe(n(`/* [truss] test.css.ts: no Css import found */`));
  });

  test("error: no named css export produces comment", () => {
    const css = transformCssTs(`import { Css } from "./Css"; const x = { ".foo": Css.df.$ };`, "test.css.ts", mapping);
    expect(n(css)).toBe(n(`/* [truss] test.css.ts: expected \`export const css = { ... }\` with an object literal */`));
  });

  test("valid selectors alongside invalid ones still emit the valid CSS", () => {
    const css = transformCssTs(
      `import { Css } from "./Css";
       const x = 5;
       export const css = {
         ".good": Css.df.$,
         ".bad": Css.mt(x).$,
         ".also-good": Css.black.$,
       };`,
      "test.css.ts",
      mapping,
    );
    expect(n(css)).toBe(
      n(`
        .good {
          display: flex;
        }

        /* [truss] unsupported: ".bad" — variable value with variable argument is not supported in .css.ts files */

        .also-good {
          color: #353535;
        }
      `),
    );
  });
});

describe("camelToKebab", () => {
  test("simple camelCase", () => {
    expect(camelToKebab("marginTop")).toBe("margin-top");
  });

  test("already kebab", () => {
    expect(camelToKebab("display")).toBe("display");
  });

  test("multiple capitals", () => {
    expect(camelToKebab("borderTopLeftRadius")).toBe("border-top-left-radius");
  });

  test("vendor prefix WebkitTransform", () => {
    expect(camelToKebab("WebkitTransform")).toBe("-webkit-transform");
  });
});

describe("trussPlugin .css.ts integration", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  function createTempRoot(): string {
    const root = mkdtempSync(join(tmpdir(), "truss-css-ts-"));
    tempDirs.push(root);
    return root;
  }

  function writeMapping(
    path: string,
    abbreviations: Record<
      string,
      { kind: string; defs?: Record<string, unknown>; props?: string[]; incremented?: boolean }
    >,
  ): void {
    mkdirSync(dirname(path), { recursive: true });
    const m = { increment: 8, abbreviations };
    writeFileSync(path, JSON.stringify(m, null, 2) + "\n", "utf8");
  }

  test("resolveId resolves ?truss-css imports to virtual CSS modules", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    const cssTs = join(root, "src", "component.css.ts");
    writeFileSync(cssTs, `import { Css } from "./Css"; export const css = { ".foo": Css.df.$ };`, "utf8");

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {} as any, { root });
    invokeHook(plugin.buildStart, {} as any);

    const resolved = invokeHook(
      plugin.resolveId,
      {} as any,
      "./component.css.ts?truss-css",
      join(root, "src", "App.tsx"),
    );
    expect(resolved).toBeTruthy();
    expect(typeof resolved).toBe("string");
    expect((resolved as string).startsWith("\0truss-css:")).toBe(true);
  });

  test("resolveId returns null for non-existent ?truss-css files", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {} as any, { root });

    const resolved = invokeHook(
      plugin.resolveId,
      {} as any,
      "./nonexistent.css.ts?truss-css",
      join(root, "src", "App.tsx"),
    );
    expect(resolved).toBeNull();
  });

  test("load generates CSS from the virtual module", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    const cssTs = join(root, "src", "component.css.ts");
    writeFileSync(cssTs, `import { Css } from "./Css"; export const css = { ".foo": Css.df.$ };`, "utf8");

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {} as any, { root });
    invokeHook(plugin.buildStart, {} as any);

    const virtualId = "\0truss-css:" + cssTs.slice(0, -3);
    const result = invokeHook(plugin.load, {} as any, virtualId);
    expect(typeof result).toBe("string");
    expect(n(result as string)).toBe(
      n(`
        .foo {
          display: flex;
        }
      `),
    );
  });

  test("transform keeps named .css.ts imports and adds a virtual CSS side effect", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root });

    const result = invokeHook(
      plugin.transform,
      {},
      `import { someClassName } from "./component.css.ts"; export function App() { return <div className={someClassName} />; }`,
      join(root, "src", "App.tsx"),
    );

    expect(result).toMatchObject({ code: expect.any(String) });
    expect(n((result as { code: string }).code)).toBe(
      n(`
        import { someClassName } from "./component.css.ts";
        import "./component.css.ts?truss-css";
        export function App() {
          return <div className={someClassName} />;
        }
      `),
    );
  });

  test("transform rewrites side-effect .css.ts imports to the virtual CSS module", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {}, { root });

    const result = invokeHook(
      plugin.transform,
      {},
      `import "./component.css.ts"; export function App() { return <div />; }`,
      join(root, "src", "App.tsx"),
    );

    expect(result).toMatchObject({ code: expect.any(String) });
    expect(n((result as { code: string }).code)).toBe(
      n(`
        import "./component.css.ts?truss-css";
        export function App() {
          return <div />;
        }
      `),
    );
  });

  test("resolveId ignores non-.css.ts imports", () => {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {} as any, { root });

    expect(invokeHook(plugin.resolveId, {} as any, "./App.tsx", join(root, "src", "main.ts"))).toBeNull();
    expect(invokeHook(plugin.resolveId, {} as any, "./styles.css", join(root, "src", "main.ts"))).toBeNull();
  });
});

function n(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function invokeHook(hook: unknown, thisArg: unknown, ...args: unknown[]): unknown {
  if (!hook) return null;
  if (typeof hook === "function") {
    return hook.call(thisArg, ...args);
  }
  if (typeof hook === "object" && hook !== null && "handler" in hook) {
    const handler = (hook as { handler?: unknown }).handler;
    if (typeof handler === "function") {
      return handler.call(thisArg, ...args);
    }
  }
  return null;
}
