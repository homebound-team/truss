import { expect } from "vitest";

declare module "vitest" {
  interface Assertion<T = any> {
    toBeNormalized(expected: string): T;
    toHaveTrussOutput(expectedCode: string, expectedCss: string): T;
  }

  interface AsymmetricMatchersContaining {
    toBeNormalized(expected: string): void;
    toHaveTrussOutput(expectedCode: string, expectedCss: string): void;
  }
}

/** Normalize whitespace in code snippets for readable test assertions. */
export function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

expect.extend({
  toBeNormalized: function (received: string | null | undefined, expected: string) {
    const normalizedExpected = normalize(expected);
    const diff = this.utils.diff(normalizedExpected, received);

    return {
      pass: this.equals(received, normalizedExpected),
      message: function () {
        return diff ?? `expected normalized strings to match`;
      },
    };
  },

  toHaveTrussOutput: function (
    received: { code: string | null; css: string | null },
    expectedCode: string,
    expectedCss: string,
  ) {
    const normalizedExpectedCode = normalize(expectedCode);
    const normalizedExpectedCss = normalize(expectedCss);
    const codeDiff = this.utils.diff(normalizedExpectedCode, received.code);
    const cssDiff = this.utils.diff(normalizedExpectedCss, received.css);

    return {
      pass: this.equals(received.code, normalizedExpectedCode) && this.equals(received.css, normalizedExpectedCss),
      message: function () {
        const messages = [];

        if (codeDiff) {
          messages.push(`Code diff:\n${codeDiff}`);
        }

        if (cssDiff) {
          messages.push(`CSS diff:\n${cssDiff}`);
        }

        return messages.join("\n\n") || `expected truss code and css outputs to match`;
      },
    };
  },
});
