import { Css } from "../Css";

export const lateClassName = "late-library-css";

export const css = {
  [`.${lateClassName}`]: Css.df.$,
};
