import { Css } from "../Css";

export const css = {
  ".build-only-css": Css.setVar({ "--test-color": "red" }).df.$,
};
