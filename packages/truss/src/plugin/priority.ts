/**
 * Computes CSS rule priority using StyleX's priority system.
 *
 * Priority is an additive sum: propertyPriority + pseudoPriority + atRulePriority + pseudoElementPriority.
 * Rules are sorted by this number before emission, guaranteeing longhands beat shorthands,
 * pseudo-classes follow LVFHA order, and at-rules override base styles — all deterministically.
 *
 * Rules that tie on priority, i.e. two `@media` rules for the same property, are ordered by the
 * width interval their query matches, widest first, so the narrower query is emitted later and
 * wins wherever both match. See `compareRuleSortKeys`.
 */

import { compareRuleSortKeys, ruleSortKey } from "../css-order";
import {
  getPropertyPriority,
  getPseudoClassPriority,
  getAtRulePriority,
  PSEUDO_ELEMENT_PRIORITY,
} from "./property-priorities";
import { WHEN_RELATIONSHIPS } from "./when-relationships";
import type { AtomicRule } from "./emit-css";

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
 * Pair each rule with its computed priority and sort with `compareRuleSortKeys`.
 *
 * Priorities and width intervals are computed once upfront so the O(n log n) comparisons are just
 * number/string compares, and callers can reuse the priorities for the `@truss p:` annotations.
 */
export function sortRulesByPriority(rules: Iterable<AtomicRule>): Array<{ rule: AtomicRule; priority: number }> {
  const decorated = Array.from(rules, (rule) => {
    const priority = computeRulePriority(rule);
    return { rule, priority, key: ruleSortKey(priority, rule.className, rule.mediaQuery) };
  });
  decorated.sort((a, b) => compareRuleSortKeys(a.key, b.key));
  return decorated.map((d) => ({ rule: d.rule, priority: d.priority }));
}
