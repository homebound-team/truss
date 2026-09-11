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
