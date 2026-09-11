import { parse, type StyleSheet } from "css-tree";
import { atRulePrelude } from "../css-order";
import type { TestCssPayload } from "../test-css";
import type { ParsedTrussCss } from "../truss-css";

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
