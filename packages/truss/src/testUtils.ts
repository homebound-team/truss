import { expect } from "vitest";

declare module "vitest" {
  interface Assertion<T = any> {
    toBeNormalized(expected: string): T;
  }

  interface AsymmetricMatchersContaining {
    toBeNormalized(expected: string): void;
  }
}

/** Normalize whitespace in code snippets for readable test assertions. */
export function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

expect.extend({
  toBeNormalized: function (received: string | null | undefined, expected: string) {
    return {
      pass: this.equals(received, normalize(expected)),
      message: function () {
        return `expected normalized strings to match`;
      },
    };
  },
});
