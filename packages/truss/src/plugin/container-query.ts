import * as t from "@babel/types";
import { type CallChainNode, UnsupportedPatternError } from "./chain-nodes";
import { numericLiteralValue, plainObjectEntries, singleArg, stringLiteralValue } from "./resolve-literals";

/** The `{ gt, lt, name }` bounds shared by `ifContainer()` and `setVar().container` rows. */
export interface ContainerBounds {
  lt?: number;
  gt?: number;
  name?: string;
}

/** Resolve ifContainer({ gt, lt, name? }) to an `@container` query string. */
export function containerQueryFromCall(node: CallChainNode): string {
  const arg = singleArg(node, "ifContainer");
  if (!t.isObjectExpression(arg)) {
    throw new UnsupportedPatternError("ifContainer() expects an object literal argument");
  }

  const bounds: ContainerBounds = {};
  for (const { key, value } of plainObjectEntries(arg, "ifContainer()")) {
    if (!readContainerBound(bounds, key, value, "ifContainer().")) {
      throw new UnsupportedPatternError(`ifContainer() does not support property "${key}"`);
    }
  }

  if (bounds.lt === undefined && bounds.gt === undefined) {
    throw new UnsupportedPatternError('ifContainer() requires at least one of "lt" or "gt"');
  }

  return containerQueryString(bounds);
}

/** Read one `lt`/`gt`/`name` bound into `bounds`; false when `key` is not a bound. */
export function readContainerBound(bounds: ContainerBounds, key: string, value: t.Expression, label: string): boolean {
  if (key === "lt") {
    bounds.lt = numericLiteralValue(value, `${label}lt must be a numeric literal`);
    return true;
  }
  if (key === "gt") {
    bounds.gt = numericLiteralValue(value, `${label}gt must be a numeric literal`);
    return true;
  }
  if (key === "name") {
    bounds.name = stringLiteralValue(value, `${label}name must be a string literal`);
    return true;
  }
  return false;
}

/** I.e. `{ gt: 400, lt: 800, name: "card" }` → `@container card (min-width: 401px) and (max-width: 800px)`. */
export function containerQueryString(bounds: ContainerBounds): string {
  const parts: string[] = [];
  if (bounds.gt !== undefined) {
    parts.push(`(min-width: ${bounds.gt + 1}px)`);
  }
  if (bounds.lt !== undefined) {
    parts.push(`(max-width: ${bounds.lt}px)`);
  }
  const namePrefix = bounds.name ? `${bounds.name} ` : "";
  return `@container ${namePrefix}${parts.join(" and ")}`;
}
