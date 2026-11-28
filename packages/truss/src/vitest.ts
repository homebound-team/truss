import type {} from "vitest";
import type { StyleExpectation } from "./toHaveStyle";

export { toHaveStyle } from "./toHaveStyle";
export type { StyleExpectation } from "./toHaveStyle";

declare module "vitest" {
  interface Matchers<R, T> {
    toHaveStyle(expected: StyleExpectation): R;
  }
}
