import { parse, type StyleSheet } from "css-tree";
import { atRulePrelude } from "../css-order";
import type { TestCssPayload } from "../test-css";
import type { ParsedTrussCss } from "../truss-css";
import { applyReferencedKeyframes } from "./at-rule-refs";
import type { TrussMapping } from "./types";

/**
 * Test-only bootstrap module that injects merged library CSS and the spacing prelude.
 *
 * Vitest/jsdom does not import `virtual:truss.css` or run browser CSS HMR; it imports modules
 * directly into the test environment, so CSS has to enter via a module side effect instead.
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
