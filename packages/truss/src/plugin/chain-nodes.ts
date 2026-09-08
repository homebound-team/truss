import type * as t from "@babel/types";

/**
 * The parsed shape of a `Css.*.$` chain: one node per getter, call, `if()`, or `else` between
 * `Css` and `.$`, in source order.
 *
 * I.e. `Css.if(cond).df.else.db.$` → `[{ type: "if" }, { type: "getter", name: "df" }, { type: "else" }, { type: "getter", name: "db" }]`.
 * Produced by `extractChain` in ast-utils and consumed by the resolve-* modules.
 */
export type ChainNode = GetterChainNode | CallChainNode | IfChainNode | ElseChainNode;

export interface GetterChainNode {
  type: "getter";
  name: string;
}

export interface CallChainNode {
  type: "call";
  name: string;
  args: (t.Expression | t.SpreadElement)[];
}

export interface IfChainNode {
  type: "if";
  conditionNode: t.Expression;
}

export interface ElseChainNode {
  type: "else";
}

/**
 * A chain pattern the compiler cannot resolve.
 *
 * Resolution catches it per node and records an error segment in the chain, which transform
 * reports as a `console.error` in the output and transform-css as a CSS comment.
 */
export class UnsupportedPatternError extends Error {
  constructor(message: string) {
    super(`[truss] Unsupported pattern: ${message}`);
    this.name = "UnsupportedPatternError";
  }
}
