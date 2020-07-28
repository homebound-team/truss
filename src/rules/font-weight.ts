import { RuleFn } from "./RuleConfig";
import { makeRules } from "../utils";

export const fontWeightRules: RuleFn = () =>
  makeRules("fontWeight", {
    normal: "normal",
    b: "bold",
    fw1: 100,
    fw2: 200,
    fw3: 300,
    fw4: 400,
    fw5: 500,
    fw6: 600,
    fw7: 700,
    fw8: 800,
    fw9: 900,
  });
