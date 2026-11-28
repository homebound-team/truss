import { parse, type StyleSheet } from "css-tree";
import { atRulePrelude } from "../css-order";
import type { TestCssPayload } from "../runtime-css";
import type { ParsedTrussCss } from "./truss-css";
import { applyReferencedKeyframes } from "./at-rule-refs";
import type { TrussMapping } from "./types";

/**
 * Test-only bootstrap module that injects merged library CSS and the spacing prelude.
 *
 * Virtual modules work in Vitest, but `virtual:truss.css` does not fit tests, for two reasons:
 *
 * - Nothing imports it. The application imports it from its entry point, and tests load
 *   components directly without that entry. The transform adds the import of this bootstrap
 *   module to each transformed file instead, so tests do not need to import anything.
 * - Its content would be incomplete. It is loaded once, with the CSS collected so far, and Vitest
 *   transforms files lazily as tests import them. Dev mode corrects this with browser CSS HMR,
 *   which does not run in tests.
 *
 * So this module only injects the CSS that is known up front, and each application module
 * injects its own CSS with `__injectTrussCSS` when it evaluates.
 */
export const TEST_CSS_BOOTSTRAP_ID = "virtual:truss:test-css";

/** Build test injection data; callers supply source identity, order, and the spacing prelude. */
export function createTestCssPayload(css: ParsedTrussCss): TestCssPayload {
  const payload: TestCssPayload = {};
  if (css.rules.length > 0) {
    payload.rules = css.rules.map((rule) => {
      const atRule = atRulePrelude(rule.cssText);
      return { ...rule, ...(atRule === undefined ? {} : { atRule }) };
    });
  }
  if (css.properties.length > 0) payload.properties = css.properties;
  if (css.keyframes.length > 0) payload.keyframes = css.keyframes;
  const arbitraryRules = css.arbitraryCssBlocks.flatMap((block) => splitArbitraryCss(block.cssText));
  if (arbitraryRules.length > 0) payload.arbitraryRules = arbitraryRules;
  return payload;
}

/**
 * Build the test injection data for one `.css.ts` file's compiled CSS.
 *
 * Raw blocks can name configured keyframes too, so the payload carries the ones this file animates.
 * I.e. `{ ".spinner": "animation: spin 1s;" }` injects the `.spinner` rule and `@keyframes spin`.
 */
export function createArbitraryTestCssPayload(css: string, source: string, mapping: TrussMapping): TestCssPayload {
  const arbitraryRules = splitArbitraryCss(css);
  const atRules: ParsedTrussCss = {
    rules: [],
    properties: [],
    keyframes: [],
    arbitraryCssBlocks: arbitraryRules.map((cssText) => ({ cssText })),
  };
  applyReferencedKeyframes(atRules, mapping);
  return {
    arbitraryRules,
    ...(atRules.keyframes.length > 0 ? { keyframes: atRules.keyframes } : {}),
    source,
  };
}

/** Split arbitrary CSS into original top-level rule slices, keeping nested content and EOF recovery intact. */
export function splitArbitraryCss(cssText: string): string[] {
  const root = parse(cssText, {
    context: "stylesheet",
    positions: true,
    parseRulePrelude: false,
    parseAtrulePrelude: false,
    parseValue: false,
  }) as StyleSheet;
  const rules: string[] = [];
  root.children.forEach((node) => {
    if (node.type === "Rule" || node.type === "Atrule") {
      rules.push(cssText.slice(node.loc!.start.offset, node.loc!.end.offset));
    }
  });
  return rules;
}
