import type {} from "vitest";
import type { StyleExpectation } from "src/toHaveStyle";

export { toHaveStyle } from "src/toHaveStyle";
export type { StyleExpectation } from "src/toHaveStyle";

declare module "vitest" {
  interface Matchers<R, T> {
    toHaveStyle(expected: StyleExpectation): R;
  }
}
