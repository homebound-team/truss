import { Css } from "~/Css";

/**
 * One `prose` class styles every descendant of the article, so its own markup
 * carries no classes at all. Block elements are matched as direct children and
 * inline elements only inside prose text, so the callout, code block and
 * prev/next cards nested in the article keep their own styling — a bare
 * `.prose p` / `.prose a` would outrank their atomic classes on specificity.
 */
export const css = {
  ".prose > h1": Css.f28.fw6.ls("-0.025em").mbPx(10).$,
  ".prose > h2": Css.f19.fw6.mtPx(30).mbPx(10).ptPx(4).$,
  ".prose > h3": Css.f15_5.fw6.mtPx(22).mbPx(8).$,
  ".prose > p": Css.f14_5.lh(1.68).muted.mbPx(14).$,
  ".prose > p:first-of-type": Css.f16.text.$,
  ".prose strong": Css.text.fw6.$,
  ".prose :is(p, li) a": Css.accent.add("textDecorationLine", "underline").add("textUnderlineOffset", "2px").$,
  ".prose > ul, .prose > ol": Css.mbPx(14).plPx(20).f14_5.lh(1.68).muted.$,
  ".prose > ul": Css.add("listStyleType", "disc").$,
  ".prose > ol": Css.add("listStyleType", "decimal").$,
  ".prose > :is(ul, ol) > li": Css.mbPx(5).$,
  ".prose > :is(ul, ol) > li::marker": Css.faint.$,
  ".prose :is(p, li) code": Css.pyPx(2).pxPx(5).br4.bgSurface2.ba.bcBorder.f12_5.fontMono.text.$,
  ".prose > table": Css.mbPx(16).f13_5.w100.$,
  ".prose > table th": Css.pyPx(9).pxPx(12).bgSurface2.bb.bcBorder.f12.fw6.tal.$,
  ".prose > table td": Css.pyPx(9).pxPx(12).bb.bcBorder.muted.$,
  ".prose > table td:first-child": Css.text.fw(550).$,
  ".prose > blockquote": Css.mbPx(16)
    .pyPx(10)
    .plPx(16)
    .add("borderLeftWidth", "3px")
    .add("borderLeftStyle", "solid")
    .bcBorderStrong.f14_5.lh(1.65).muted.fsyi.$,
};
