import { Css } from "~/Css";

/**
 * Selectors a `Css.*.$` chain cannot express: the switch knob is a pseudo-element
 * driven by a preceding sibling, and the selected radio card comes from `:has()`.
 * Truss compiles these into the same stylesheet and the route attaches the
 * anchor classes with `Css.className(...)`.
 */
export const css = {
  ".switchTrack::after": Css.content('""')
    .absolute.topPx(3)
    .leftPx(3)
    .sqPx(16)
    .brPill.bgWhite.shadowSm.transform("translateX(0)")
    .transitionSlow.$,
  "input:checked + .switchTrack": Css.bgAccent.$,
  "input:checked + .switchTrack::after": Css.transform("translateX(16px)").$,
  ".radioCard:has(input:checked)": Css.bcAccent.bgAccentSoft.$,
};
