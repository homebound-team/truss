import { newMethodsForProp, newParamMethod } from "../methods";
import { MethodFn } from "../config";

// https://github.com/tachyons-css/tachyons-z-index/blob/master/src/tachyons-z-index.css
export const zIndex: MethodFn = (config) => [
  // Even though we define const z0/z1/etc indexes to follow Tachyons, ideally applications
  // should define their own application-specific indexes, i.e.:
  //
  // export const zIndexes = {
  //  ourModals: 10,
  //  ourLabels: 12,
  // }
  //
  // And then use `Css.z(zIndexes.ourModals).$` to get better documentation and maintainability
  // then just using the zN abbreviations.
  ...newMethodsForProp("zIndex", {
    z0: 0,
    z1: 1,
    z2: 2,
    z3: 3,
    z4: 4,
    z5: 5,
    z999: 999,
    z9999: 9999,
    zInherit: "inherit",
    zInitial: "initial",
    zUnset: "unset",
  }),
  newParamMethod("z", "zIndex"),
];
