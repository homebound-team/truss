import { RuleFn } from "./RuleConfig";

export const boxShadowRules: RuleFn = () => [
  `get shadowNone() { return this.add("boxShadow", "none") }`,
];
