import * as t from "@babel/types";
import type { WhenCondition } from "./types";
import { type CallChainNode, UnsupportedPatternError } from "./chain-nodes";
import { isWhenRelationship, WHEN_RELATIONSHIPS } from "./when-relationships";

/** A same-element selector (`when(":hover")`) or a relationship to a marker (`when(marker, "ancestor", ":hover")`). */
export type WhenCallResolution =
  | { kind: "selector"; selector: string }
  | { kind: "relationship"; condition: WhenCondition };

/**
 * Resolve a `when(selector)` or `when(marker, relationship, pseudo)` call.
 *
 * - 1 arg: `when(":hover")` / `when('[data-state="open"]')` — same-element selector,
 *   must be a string literal
 * - 3 args: `when(marker, "ancestor", ":hover")` — marker must be a marker variable or
 *   the shared `marker` token, relationship/pseudo must be string literals
 *
 * The object form `when({ ":hover": Css.blue.$ })` is handled by resolve-chain, since it recurses.
 */
export function resolveWhenCall(node: CallChainNode): WhenCallResolution {
  if (node.args.length !== 1 && node.args.length !== 3) {
    throw new UnsupportedPatternError(
      `when() expects 1 or 3 arguments (selector) or (marker, relationship, pseudo), got ${node.args.length}`,
    );
  }

  if (node.args.length === 1) {
    const selectorArg = node.args[0];
    if (!t.isStringLiteral(selectorArg)) {
      throw new UnsupportedPatternError(`when() selector must be a string literal`);
    }
    return { kind: "selector", selector: selectorArg.value };
  }

  const [markerArg, relationshipArg, pseudoArg] = node.args;
  const markerNode = resolveWhenMarker(markerArg);
  if (!t.isStringLiteral(relationshipArg)) {
    throw new UnsupportedPatternError(`when() relationship argument must be a string literal`);
  }
  const relationship = relationshipArg.value;
  if (!isWhenRelationship(relationship)) {
    throw new UnsupportedPatternError(
      `when() relationship must be one of: ${Object.keys(WHEN_RELATIONSHIPS).join(", ")} -- got "${relationship}"`,
    );
  }
  if (!t.isStringLiteral(pseudoArg)) {
    throw new UnsupportedPatternError(`when() pseudo selector (3rd argument) must be a string literal`);
  }
  return { kind: "relationship", condition: { pseudo: pseudoArg.value, markerNode, relationship } };
}

/** The user's marker variable, or undefined for the shared default marker. */
function resolveWhenMarker(node: t.Expression | t.SpreadElement): t.Identifier | undefined {
  if (isDefaultMarkerNode(node)) {
    return undefined;
  }
  if (t.isIdentifier(node)) {
    return node;
  }
  throw new UnsupportedPatternError(`when() marker must be a marker variable or marker`);
}

/** I.e. `marker`, `defaultMarker`, or the legacy `Css.defaultMarker()` call. */
function isDefaultMarkerNode(node: t.Expression | t.SpreadElement): boolean {
  if (t.isIdentifier(node) && (node.name === "marker" || node.name === "defaultMarker")) {
    return true;
  }
  return (
    t.isCallExpression(node) &&
    node.arguments.length === 0 &&
    t.isMemberExpression(node.callee) &&
    !node.callee.computed &&
    t.isIdentifier(node.callee.property, { name: "defaultMarker" })
  );
}
