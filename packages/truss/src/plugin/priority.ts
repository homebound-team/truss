/**
 * Computes CSS rule priority using StyleX's priority system.
 *
 * Priority is an additive sum: propertyPriority + pseudoPriority + atRulePriority + pseudoElementPriority.
 * Rules are sorted by this number before emission, guaranteeing longhands beat shorthands,
 * pseudo-classes follow LVFHA order, and at-rules override base styles — all deterministically.
 */

import {
  getPropertyPriority,
  getPseudoClassPriority,
  getAtRulePriority,
  PSEUDO_ELEMENT_PRIORITY,
} from "./property-priorities";
import { WHEN_RELATIONSHIPS } from "./when-relationships";
import type { AtomicRule } from "./emit-truss";

/**
 * Compute the numeric priority for a single AtomicRule.
 *
 * I.e. a rule with `declarations: [{ cssProperty: "border-top-color", ... }]`, `pseudoClass: ":hover"`,
 * `mediaQuery: "@media ..."` → 4000 (physical longhand) + 130 (:hover) + 200 (@media) = 4330
 */
export function computeRulePriority(rule: AtomicRule): number {
  let priority = getPropertyPriority(rule.declarations[0].cssProperty);

  if (rule.pseudoElement) {
    priority += PSEUDO_ELEMENT_PRIORITY;
  }

  if (rule.pseudoClass) {
    priority += getPseudoClassPriority(rule.pseudoClass);
  }

  if (rule.mediaQuery) {
    priority += getAtRulePriority(rule.mediaQuery);
  }

  if (rule.whenSelector) {
    const relBase = WHEN_RELATIONSHIPS[rule.whenSelector.relationship].priority;
    const pseudoFraction = getPseudoClassPriority(rule.whenSelector.pseudo) / 100;
    priority += relBase + pseudoFraction;
  }

  // Variable rules get a small bonus (+0.5) so they sort after static rules for the same property
  if (isVariableRule(rule)) {
    priority += 0.5;
  }

  return priority;
}

/** Returns true if this rule uses CSS custom property var() values. */
function isVariableRule(rule: AtomicRule): boolean {
  return rule.declarations.some((d) => d.cssVarName !== undefined);
}

/**
 * Pair each rule with its computed priority and sort ascending.
 *
 * When two rules have the same priority (e.g. two different longhands both at 3000),
 * we tiebreak by class name so the output is fully deterministic regardless of
 * file processing order (which differs between dev HMR and production builds).
 *
 * Priorities are computed once upfront so the O(n log n) comparisons are just
 * number/string compares, and callers can reuse them for the `@truss p:` annotations.
 */
export function sortRulesByPriority(rules: Iterable<AtomicRule>): Array<{ rule: AtomicRule; priority: number }> {
  const decorated = Array.from(rules, (rule) => {
    return { rule, priority: computeRulePriority(rule) };
  });
  decorated.sort((a, b) => {
    return a.priority - b.priority || compareClassNames(a.rule.className, b.rule.className);
  });
  return decorated;
}

/** Code-point order, so identical class sets sort identically in dev and production. */
export function compareClassNames(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
