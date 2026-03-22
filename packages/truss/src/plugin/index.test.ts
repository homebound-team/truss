import { afterEach, describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { tmpdir } from "os";
import { trussPlugin } from "./index";

const tempDirs: string[] = [];

afterEach(function () {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.length = 0;
});

describe("trussPlugin", function () {
  test("uses the configured mapping for library files", function () {
    // Given we have a src/Css.json
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // And are the application itself, or library in vitest, pointing to src/Css.json
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    runConfigHooks(plugin, root);
    // When we see an import from Css
    const result = runTransform(
      plugin,
      `import { Css } from "./Css"; const el = <div css={Css.df.$} />;`,
      join(root, "src", "Button.tsx"),
    );
    // Then it is rewritten
    expect(n(result?.code ?? "")).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "df" })} />;
      `),
    );
  });

  test("skips node_modules files unless package is in externalPackages", function () {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // Given we're the application or library in vitest, using src/Css.json
    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    runConfigHooks(plugin, root);
    // And we have code that is not in an externalPackages
    const result = runTransform(
      plugin,
      `import { Css } from "./Css"; const el = <div css={Css.df.$} />;`,
      join(root, "node_modules", "acme-ui", "src", "Button.tsx"),
    );
    // Then it is not transformed
    expect(result).toBeNull();
  });

  test("transforms whitelisted external package files", function () {
    const root = createTempRoot();
    writeMapping(join(root, "node_modules", "@company", "library", "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // Given we're running the application build, pointing to the library's Css.json
    const plugin = trussPlugin({
      mapping: "./node_modules/@company/library/src/Css.json",
      externalPackages: ["@company/library"],
    });
    runConfigHooks(plugin, root);
    const result = runTransform(
      plugin,
      `import { Css } from "./Css.js"; const el = <div css={Css.df.$} />;`,
      join(root, "node_modules", "@company", "library", "src", "Button.tsx"),
    );
    expect(n(result?.code ?? "")).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "df" })} />;
      `),
    );
  });

  test("transforms application files importing library Css.ts", function () {
    const root = createTempRoot();
    writeMapping(join(root, "node_modules", "@company", "library", "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });
    // Given we're running the application build, pointing to the library's Css.json
    const plugin = trussPlugin({
      mapping: "./node_modules/@company/library/src/Css.json",
      externalPackages: ["@company/library"],
    });
    runConfigHooks(plugin, root);
    // And we have application src/Button.tsx importing Css from the library
    const result = runTransform(
      plugin,
      `import { Css } from "@company/library"; const el = <div css={Css.df.$} />;`,
      join(root, "src", "Button.tsx"),
    );
    // Then it gets transformed
    expect(n(result?.code ?? "")).toBe(
      n(`
        import { trussProps } from "@homebound/truss/runtime";
        const el = <div {...trussProps({ display: "df" })} />;
      `),
    );
  });

  test("dev html injects the runtime without a stylesheet link", function () {
    const root = createTempRoot();
    writeMapping(join(root, "src", "Css.json"), {
      df: { kind: "static", defs: { display: "flex" } },
    });

    const plugin = trussPlugin({ mapping: "./src/Css.json" });
    invokeHook(plugin.configResolved, {} as any, { root, command: "serve", mode: "development" } as any);

    const html = invokeHook(plugin.transformIndexHtml, {} as any, "<html><head></head><body></body></html>") as any;
    expect(html).toBeTypeOf("string");
    expect(html.includes('<script type="module" src="/virtual:truss:runtime"></script>')).toBe(true);
    expect(html.includes("/virtual:truss.css")).toBe(false);
  });
});

function n(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function createTempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "truss-stylex-"));
  tempDirs.push(root);
  return root;
}

function writeMapping(
  path: string,
  abbreviations: Record<string, { kind: string; defs?: Record<string, unknown> }>,
): void {
  mkdirSync(dirname(path), { recursive: true });
  const mapping = {
    increment: 8,
    abbreviations,
  };
  writeFileSync(path, `${JSON.stringify(mapping, null, 2)}\n`, "utf8");
}

function runConfigHooks(plugin: ReturnType<typeof trussPlugin>, root: string): void {
  invokeHook(plugin.configResolved, {} as any, { root } as any);
  invokeHook(plugin.buildStart, {} as any);
}

function runTransform(
  plugin: ReturnType<typeof trussPlugin>,
  code: string,
  id: string,
): { code: string; map: any } | null {
  const result = invokeHook(plugin.transform, {} as any, code, id);
  if (!result || typeof result !== "object" || !("code" in result)) {
    return null;
  }
  return result as { code: string; map: any };
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
