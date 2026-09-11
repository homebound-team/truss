import type { ParsedCssRule, ParsedKeyframesBlock, ParsedPropertyDeclaration } from "./truss-css";

/** An atomic rule ready for CSSOM insertion, with query metadata supplied by the plugin. */
export interface TestCssRule extends ParsedCssRule {
  atRule?: string;
}

/** Structured static CSS delivered by generated test modules, not a serialized truss.css file. */
export interface TestCssPayload {
  rules?: TestCssRule[];
  properties?: ParsedPropertyDeclaration[];
  keyframes?: ParsedKeyframesBlock[];
  /** Complete top-level rules, split by the plugin with nested at-rules left intact. */
  arbitraryRules?: string[];
  /** Canonical application source path, or the combined library source; required for arbitrary rules. */
  source?: string;
  /** Libraries use 0 and application modules use 1, matching the production merge. */
  order?: number;
  prelude?: string;
}
