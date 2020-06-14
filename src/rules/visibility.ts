import { RuleFn } from "./RuleConfig";

export const visibilityRules: RuleFn = () => [
  // https://tailwindcss.com/docs/visibility/
  `get visible() { return this.add("visibility", "visible"); }`,
  `get invisible() { return this.add("visibility", "hidden"); }`,
];
