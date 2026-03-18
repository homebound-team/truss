import { generate } from "src/generate";
import { describe, expect, it } from "vitest";

describe("generate", () => {
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
      'Unsupported truss target "emotion". Use "stylex" (default) or "react-native".',
    );
  });
});
