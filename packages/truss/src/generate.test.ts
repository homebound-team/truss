import { mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { type Config } from "src/config";
import { generate } from "src/generate";
import { describe, expect, it } from "vitest";

describe("generate", () => {
  it("escapes double quotes in palette and font values and imports csstype as a type", async () => {
    // Given a config whose palette value contains a double quote
    const dir = mkdtempSync(join(tmpdir(), "truss-generate-"));
    const config: Config = {
      outputPath: join(dir, "Css.ts"),
      palette: { Quoted: 'a"b' },
      // And a font whose family list quotes a name, as CSS requires for names with spaces
      fonts: { body: { fontFamily: '"Helvetica Neue", sans-serif' } },
      increment: 8,
      numberOfIncrements: 1,
    };
    try {
      // When we generate the Css.ts file
      await generate(config);
      const lines = readFileSync(config.outputPath, "utf8").split("\n");
      // Then csstype is imported as a type
      expect(lines[0]).toEqual('import type { Properties as Properties1 } from "csstype";');
      // And the palette value keeps its double quote
      expect(lines.find((line) => line.includes("Quoted ="))).toEqual("  Quoted = 'a\"b',");
      // And the font family keeps the quotes around the name with a space
      const bodyIndex = lines.findIndex((line) => line.includes("get body()"));
      expect(lines[bodyIndex + 1]).toEqual('    return this.add("fontFamily", \'"Helvetica Neue", sans-serif\');');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("registers tokens with @property and emits a Keyframes enum", async () => {
    // Given a config with one plain token and one registered with a syntax
    const dir = mkdtempSync(join(tmpdir(), "truss-generate-"));
    const config: Config = {
      outputPath: join(dir, "Css.ts"),
      palette: {},
      fonts: {},
      increment: 8,
      numberOfIncrements: 1,
      tokens: {
        ThemePrimary: "--theme-primary",
        Angle: { var: "--angle", syntax: "<angle>", inherits: false, initialValue: "0deg" },
      },
      // And keyframes in all three forms: typed declarations, a raw body, and a name defined elsewhere
      keyframes: {
        spin: { to: { transform: "rotate(360deg)" } },
        shimmer: "from { background-position: 200% 0; }",
        aiStarLoader: null,
      },
    };
    try {
      // When we generate the Css.ts file and its mapping
      await generate(config);
      const lines = readFileSync(config.outputPath, "utf8").split("\n");
      const mapping = JSON.parse(readFileSync(join(dir, "Css.json"), "utf8"));

      // Then both token forms produce the same kind of enum member
      expect(lines.find((line) => line.includes("ThemePrimary ="))).toEqual('  ThemePrimary = "--theme-primary",');
      expect(lines.find((line) => line.includes("Angle ="))).toEqual('  Angle = "--angle",');
      // And every keyframe name is a PascalCase member of its own enum
      expect(lines.find((line) => line.includes("Spin ="))).toEqual('  Spin = "spin",');
      expect(lines.find((line) => line.includes("AiStarLoader ="))).toEqual('  AiStarLoader = "aiStarLoader",');

      // And the mapping names both tokens the same way, since registering one does not rename it
      expect(mapping.tokens).toEqual({ ThemePrimary: "--theme-primary", Angle: "--angle" });
      // And only the registered one carries an @property block
      expect(mapping.properties).toEqual({
        "--angle": '@property --angle { syntax: "<angle>"; inherits: false; initial-value: 0deg; }',
      });
      // And the raw body is passed through while the externally defined name maps to no block
      expect(mapping.keyframes).toEqual({
        spin: "@keyframes spin { to { transform: rotate(360deg); } }",
        shimmer: "@keyframes shimmer { from { background-position: 200% 0; } }",
        aiStarLoader: "",
      });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws for a registered token whose syntax has no initial value", async () => {
    // Given a token registered with a real syntax but no initialValue, which the browser would reject
    const dir = mkdtempSync(join(tmpdir(), "truss-generate-"));
    const config: Config = {
      outputPath: join(dir, "Css.ts"),
      palette: {},
      fonts: {},
      increment: 8,
      numberOfIncrements: 1,
      tokens: { Angle: { var: "--angle", syntax: "<angle>" } },
    };

    try {
      await expect(generate(config)).rejects.toThrow(
        'Token "Angle" has syntax "<angle>" but no initialValue. ' +
          '@property requires an initial value for every syntax except "*".',
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("throws for unsupported targets", async () => {
    const config = {
      outputPath: "./ignore.ts",
      palette: {},
      fonts: {},
      increment: 8,
      numberOfIncrements: 4,
      target: "emotion",
    } as any;

    await expect(generate(config)).rejects.toThrow(
      'Unsupported truss target "emotion". Use "web" (default) or "react-native".',
    );
  });
});
