import { Css } from "./Css";

/** Mini CSS reset using Truss tokens, compiled to plain CSS at build time. */
export default {
  "*, *::before, *::after": Css.add("boxSizing", "border-box").$,
  body: Css.m0.p0.f14.black.$,
  "h1, h2, h3, h4, h5, h6": Css.add("fontWeight", "inherit").add("fontSize", "inherit").$,
  "button, input, select, textarea": Css.add("fontFamily", "inherit").add("fontSize", "inherit").$,
};
