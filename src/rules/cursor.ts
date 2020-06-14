import { RuleFn } from "./RuleConfig";

export const cursorRules: RuleFn = () => [
  `get cursorPointer() { return this.add("cursor", "pointer") }`,
];
