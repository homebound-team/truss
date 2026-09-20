import { Css } from "~/Css";

/** The FAQ accordion glyph: a pseudo-element flipped by `details[open]`, so no React state. */
export const css = {
  ".faqSummary::-webkit-details-marker": Css.dn.$,
  ".faqSummary::after": Css.content('"+"').f17.fw4.muted.lh(1).$,
  "details[open] .faqSummary::after": Css.content('"−"').$,
};
