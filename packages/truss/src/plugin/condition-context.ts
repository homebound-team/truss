import type { ResolvedConditionContext } from "./types";

/** The context with no modifier axes active. */
export function emptyConditionContext(): ResolvedConditionContext {
  return {
    mediaQuery: null,
    pseudoClass: null,
    pseudoElement: null,
    whenPseudo: null,
  };
}

/** `WhenCondition` objects are never mutated after creation, so a shallow copy is a full snapshot. */
export function cloneConditionContext(context: ResolvedConditionContext): ResolvedConditionContext {
  return { ...context };
}

/** Clear every axis in place, i.e. for `end`. */
export function resetConditionContext(context: ResolvedConditionContext): void {
  Object.assign(context, emptyConditionContext());
}
