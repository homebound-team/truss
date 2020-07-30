export { RuleConfig, RuleFn } from "./RuleConfig";
import { borderColorRules } from "./border-colors";
import { borderRadiusRules } from "./border-radius";
import { borderRules } from "./borders";
import { borderStyleRules } from "./border-styles";
import { borderWidthRules } from "./border-widths";
import { boxShadowRules } from "./box-shadow";
import { coordinateRules } from "./coordinates";
import { cursorRules } from "./cursor";
import { displayRules } from "./display";
import { flexboxRules } from "./flexbox";
import { floatRules } from "./floats";
import { fontWeightRules } from "./font-weight";
import { heightRules } from "./heights";
import { outlineRules } from "./outlines";
import { positionRules } from "./position";
import { RuleFn } from "./RuleConfig";
import { skinRules } from "./skins";
import { spacingRules } from "./spacing";
import { textAlignRules } from "./text-align";
import { textDecorationRules } from "./text-decoration";
import { textTransformRules } from "./text-transform";
import { typeScaleRules } from "./type-scale";
import { userSelectRules } from "./user-select";
import { verticalAlignRules } from "./vertical-align";
import { visibilityRules } from "./visibility";
import { whitespaceRules } from "./white-space";
import { widthRules } from "./widths";
import { zIndexRules } from "./zIndex";

export const defaultRuleFns: Record<string, RuleFn> = {
  borderColorRules,
  borderRadiusRules,
  borderRules,
  borderStyleRules,
  borderWidthRules,
  boxShadowRules,
  coordinateRules,
  cursorRules,
  displayRules,
  flexboxRules,
  floatRules,
  fontWeightRules,
  heightRules,
  outlineRules,
  positionRules,
  skinRules,
  spacingRules,
  textAlignRules,
  textDecorationRules,
  textTransformRules,
  typeScaleRules,
  userSelectRules,
  verticalAlignRules,
  visibilityRules,
  whitespaceRules,
  widthRules,
  zIndexRules,
};
