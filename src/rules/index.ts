export { RuleConfig, RuleFn } from "./RuleConfig";
import { RuleFn } from "./RuleConfig";
import { borderColorRules } from "./border-colors";
import { borderRadiusRules } from "./border-radius";
import { borderRules } from "./borders";
import { boxShadowRules } from "./box-shadow";
import { coordinateRules } from "./coordinates";
import { cursorRules } from "./cursor";
import { displayRules } from "./display";
import { flexboxRules } from "./flexbox";
import { heightRules } from "./heights";
import { outlineRules } from "./outlines";
import { positionRules } from "./position";
import { skinRules } from "./skins";
import { spacingRules } from "./spacing";
import { textAlignRules } from "./text-align";
import { textDecorationRules } from "./text-decoration";
import { typeScaleRules } from "./type-scale";
import { whitespaceRules } from "./white-space";
import { widthRules } from "./widths";
import { visibilityRules } from "./visibility";

export const defaultRuleFns: Record<string, RuleFn> = {
  borderColorRules,
  borderRadiusRules,
  borderRules,
  boxShadowRules,
  coordinateRules,
  cursorRules,
  displayRules,
  flexboxRules,
  heightRules,
  outlineRules,
  positionRules,
  skinRules,
  spacingRules,
  textAlignRules,
  textDecorationRules,
  typeScaleRules,
  whitespaceRules,
  widthRules,
  visibilityRules,
};
