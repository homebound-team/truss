import type {} from "vitest";
import type { StyleExpectation } from "src/toHaveStyle";

export { toHaveStyle } from "src/toHaveStyle";
export type { StyleExpectation } from "src/toHaveStyle";

declare module "vitest" {
  interface Assertion<T = any> {
    toHaveStyle(expected: StyleExpectation): T;
  }

  interface AsymmetricMatchersContaining {
    toHaveStyle(expected: StyleExpectation): void;
  }
}
