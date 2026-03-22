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
import type { AtomicRule } from "./emit-truss";

/** Relationship base priorities for when() selectors, matching StyleX's relational selector system. */
const RELATIONSHIP_BASE: Record<string, number> = {
  ancestor: 10,
  descendant: 15,
  anySibling: 20,
  siblingBefore: 30,
  siblingAfter: 40,
};

/**
 * Compute the numeric priority for a single AtomicRule.
 *
 * I.e. `{ cssProperty: "border-top-color", pseudoClass: ":hover", mediaQuery: "@media ..." }`
 * → 4000 (physical longhand) + 130 (:hover) + 200 (@media) = 4330
 */
export function computeRulePriority(rule: AtomicRule): number {
  let priority = getPropertyPriority(rule.cssProperty);

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
    const relBase = RELATIONSHIP_BASE[rule.whenSelector.relationship] ?? 10;
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
  if (rule.declarations) {
    return rule.declarations.some(function (d) {
      return d.cssVarName !== undefined;
    });
  }
  return rule.cssVarName !== undefined;
}

/** Sort an array of AtomicRules in-place by their computed priority. */
export function sortRulesByPriority(rules: AtomicRule[]): void {
  rules.sort(function (a, b) {
    return computeRulePriority(a) - computeRulePriority(b);
  });
}
